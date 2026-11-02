import { execFile } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TaskCase } from '../cases/schema.js';

const exec = promisify(execFile);

export type WorkspaceSetup = TaskCase['setup'];

export interface PreparedWorkspace {
  workdir: string;
  /** Changes since the workspace was prepared (git diff, lockfiles and the skill folder excluded). */
  diff(): Promise<string>;
  cleanup(): Promise<void>;
}

export interface WorkspaceManager {
  prepare(options: { setup: WorkspaceSetup; skillInstallPath: string; withSkill: boolean }): Promise<PreparedWorkspace>;
}

export type TemplateMaterializer = (templateId: string, target: string) => Promise<void>;

export interface GitWorkspaceOptions {
  /** The working copy of the skill under test. */
  skillDir: string;
  /** Folder that `setup.fixture` paths are relative to. */
  fixturesDir: string;
  /** Keep temp folders after the run, for debugging. */
  keep?: boolean;
  materialize?: TemplateMaterializer;
}

const IGNORED = ['node_modules/', 'dist/', '.angular/'];
const DIFF_EXCLUDES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
const MAX_DIFF_CHARS = 200_000;

/**
 * Creates a fresh temp folder per run, seeds it, installs the skill where the tool discovers it,
 * and commits the starting state to a throwaway git repo so the final diff is exact.
 */
export class GitWorkspaceManager implements WorkspaceManager {
  constructor(private readonly options: GitWorkspaceOptions) {}

  async prepare({ setup, skillInstallPath, withSkill }: { setup: WorkspaceSetup; skillInstallPath: string; withSkill: boolean }) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'iointel-eval-'));
    const workdir = path.join(root, 'work');

    if ('template' in setup) {
      await (this.options.materialize ?? this.materializeWithSkillScript)(setup.template, workdir);
    } else if ('fixture' in setup) {
      await cp(path.resolve(this.options.fixturesDir, setup.fixture), workdir, { recursive: true });
    } else {
      await mkdir(workdir);
    }

    await ensureGitignore(workdir);
    const skillRel = skillInstallPath.replaceAll('\\', '/');
    if (withSkill) await cp(this.options.skillDir, path.join(workdir, skillInstallPath), { recursive: true });

    await git(workdir, ['init', '-q']);
    await git(workdir, ['add', '-A']);
    await git(workdir, ['commit', '-q', '--no-verify', '--allow-empty', '-m', 'eval: starting state']);

    return {
      workdir,
      diff: async () => {
        await git(workdir, ['add', '-A']);
        const excludes = [...DIFF_EXCLUDES.map((f) => `:(exclude,glob)**/${f}`), `:(exclude)${skillRel}`];
        const { stdout } = await git(workdir, ['diff', '--cached', '--no-color', '--', '.', ...excludes]);
        return stdout.length > MAX_DIFF_CHARS
          ? `${stdout.slice(0, MAX_DIFF_CHARS)}\n[diff truncated at ${MAX_DIFF_CHARS} characters]`
          : stdout;
      },
      cleanup: async () => {
        if (!this.options.keep) await rm(root, { recursive: true, force: true, maxRetries: 3 });
      },
    };
  }

  private materializeWithSkillScript: TemplateMaterializer = async (templateId, target) => {
    const script = path.join(this.options.skillDir, 'scripts', 'materialize-template.mjs');
    await exec(process.execPath, [script, '--template', templateId, '--target', target], { maxBuffer: 10 * 1024 * 1024 });
  };
}

async function ensureGitignore(workdir: string) {
  const file = path.join(workdir, '.gitignore');
  const existing = await readFile(file, 'utf8').catch(() => '');
  const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = IGNORED.filter((p) => !lines.has(p) && !lines.has(p.replace(/\/$/, '')) && !lines.has(`/${p}`));
  if (missing.length) await appendFile(file, `${existing && !existing.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
}

function git(cwd: string, args: string[]) {
  return exec(
    'git',
    ['-c', 'user.name=eval', '-c', 'user.email=eval@localhost', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
    { cwd, maxBuffer: 50 * 1024 * 1024 },
  );
}
