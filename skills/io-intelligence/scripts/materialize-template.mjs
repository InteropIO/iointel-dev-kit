#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(scriptDirectory, "../references/template-catalog.json");
const provenanceFileName = ".io-intelligence-template.json";
const supportedNodeMajor = 18;

function printUsage() {
  process.stdout.write(`Usage:
  node materialize-template.mjs --list
  node materialize-template.mjs --template <id> --target <path>

Options:
  --list             List available templates without downloading source.
  --template <id>    Select one template from the bundled catalog.
  --target <path>    Materialize into an absent or empty directory.
  --help             Show this help.
`);
}

function parseArguments(argv) {
  const result = { help: false, list: false, template: undefined, target: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      result.help = true;
      continue;
    }

    if (argument === "--list") {
      result.list = true;
      continue;
    }

    if (argument === "--template") {
      result.template = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--target") {
      result.target = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return result;
}

async function loadCatalog() {
  const rawCatalog = await readFile(catalogPath, "utf8");
  const catalog = JSON.parse(rawCatalog);

  if (catalog.schemaVersion !== 1) {
    throw new Error(`Unsupported template catalog schema: ${catalog.schemaVersion}`);
  }

  const repository = new URL(catalog.repository);
  if (repository.protocol !== "https:") {
    throw new Error("The template repository must use HTTPS.");
  }

  if (!catalog.templates || typeof catalog.templates !== "object") {
    throw new Error("The template catalog contains no templates.");
  }

  return catalog;
}

function validateTemplate(id, template) {
  if (!template) {
    throw new Error(`Unknown template: ${id}`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Unsafe template identifier: ${id}`);
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(template.tag)) {
    throw new Error(`Unsafe immutable Git tag for ${id}: ${template.tag}`);
  }

  const expectedPath = `templates/${id}`;
  if (template.path !== expectedPath) {
    throw new Error(`Template ${id} must use the catalog path ${expectedPath}.`);
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function inspectTarget(targetPath) {
  if (!(await pathExists(targetPath))) {
    return { existed: false };
  }

  const targetStats = await stat(targetPath);
  if (!targetStats.isDirectory()) {
    throw new Error(`Target exists and is not a directory: ${targetPath}`);
  }

  const entries = await readdir(targetPath);
  if (entries.length > 0) {
    throw new Error(`Target directory must be empty: ${targetPath}`);
  }

  return { existed: true };
}

function runGit(arguments_, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", arguments_, {
      cwd,
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.once("error", (error) => {
      if (error.code === "ENOENT") {
        rejectPromise(new Error("Git is required to materialize templates but was not found."));
        return;
      }

      rejectPromise(error);
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const ending = signal ? `signal ${signal}` : `exit code ${code}`;
      rejectPromise(new Error(`Git command failed with ${ending}: git ${arguments_.join(" ")}`));
    });
  });
}

async function rejectSymbolicLinks(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Template contains an unsupported symbolic link: ${entryPath.slice(root.length + 1)}`);
    }

    if (entry.isDirectory()) {
      await rejectSymbolicLinks(entryPath, root);
    }
  }
}

async function retrieveTemplate(repository, template, checkoutDirectory) {
  await runGit(["init", "--quiet"], checkoutDirectory);
  await runGit(["remote", "add", "origin", repository], checkoutDirectory);
  await runGit(["sparse-checkout", "init", "--cone"], checkoutDirectory);
  await runGit(["sparse-checkout", "set", template.path], checkoutDirectory);
  await runGit(
    [
      "fetch",
      "--quiet",
      "--depth",
      "1",
      "--filter=blob:none",
      "origin",
      `refs/tags/${template.tag}:refs/tags/${template.tag}`,
    ],
    checkoutDirectory,
  );
  await runGit(["checkout", "--quiet", "--detach", `refs/tags/${template.tag}`], checkoutDirectory);

  const sourceDirectory = join(checkoutDirectory, ...template.path.split("/"));
  if (!(await pathExists(sourceDirectory))) {
    throw new Error(`Template path does not exist at tag ${template.tag}: ${template.path}`);
  }

  await rejectSymbolicLinks(sourceDirectory);
  return sourceDirectory;
}

async function writeProvenance(stagingDirectory, id, template, repository) {
  const provenance = {
    schemaVersion: 1,
    template: id,
    displayName: template.displayName,
    framework: template.framework,
    mode: template.mode,
    ioConnectClient: template.ioConnectClient === true,
    source: {
      repository,
      tag: template.tag,
      path: template.path,
    },
    materializedAt: new Date().toISOString(),
  };

  await writeFile(
    join(stagingDirectory, provenanceFileName),
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );
}

async function materialize(catalog, id, targetInput) {
  const template = catalog.templates[id];
  validateTemplate(id, template);

  if (!targetInput) {
    throw new Error("--target is required when materializing a template.");
  }

  const targetPath = resolve(process.cwd(), targetInput);
  if (targetPath === resolve(sep)) {
    throw new Error("Refusing to use the filesystem root as the target.");
  }

  const targetState = await inspectTarget(targetPath);
  const targetParent = dirname(targetPath);
  await mkdir(targetParent, { recursive: true });

  const workingDirectory = await mkdtemp(join(tmpdir(), "io-intelligence-template-"));
  const checkoutDirectory = join(workingDirectory, "repository");
  const stagingDirectory = join(
    targetParent,
    `.${basename(targetPath)}.io-intelligence-${process.pid}-${randomBytes(6).toString("hex")}`,
  );
  let removedExistingTarget = false;

  try {
    await mkdir(checkoutDirectory);
    const sourceDirectory = await retrieveTemplate(catalog.repository, template, checkoutDirectory);
    await cp(sourceDirectory, stagingDirectory, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
    });
    await writeProvenance(stagingDirectory, id, template, catalog.repository);

    if (targetState.existed) {
      await rmdir(targetPath);
      removedExistingTarget = true;
    }

    await rename(stagingDirectory, targetPath);
    removedExistingTarget = false;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    if (removedExistingTarget) {
      await mkdir(targetPath, { recursive: true });
    }
    throw error;
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }

  process.stdout.write(
    `Materialized ${id} from ${catalog.repository}@${template.tag}:${template.path}\n` +
      `Target: ${targetPath}\n` +
      `Provenance: ${join(targetPath, provenanceFileName)}\n`,
  );
}

async function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (nodeMajor < supportedNodeMajor) {
    throw new Error(`Node.js ${supportedNodeMajor} or newer is required.`);
  }

  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.help) {
    printUsage();
    return;
  }

  const catalog = await loadCatalog();

  if (arguments_.list) {
    if (arguments_.template || arguments_.target) {
      throw new Error("--list cannot be combined with --template or --target.");
    }

    for (const [id, template] of Object.entries(catalog.templates)) {
      process.stdout.write(`${id}\t${template.displayName}\t${template.description}\n`);
    }
    return;
  }

  if (!arguments_.template) {
    throw new Error("--template is required. Use --list to see available templates.");
  }

  await materialize(catalog, arguments_.template, arguments_.target);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
