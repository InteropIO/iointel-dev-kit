import { spawn } from "node:child_process";
import type { CommandRunner } from "../types.js";

const MAX_OUTPUT_CHARS = 200_000;

/** Runs a shell command; exitCode is null when it timed out. */
export const runShellCommand: CommandRunner = (command, cwd, timeoutMs) =>
  new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true });
    let output = "";
    const append = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-MAX_OUTPUT_CHARS);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, output: output + String(err) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: timedOut ? null : (code ?? 1), output });
    });
  });
