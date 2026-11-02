import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { codexCost } from '../src/adapters/codex.js';
import { extractCodexFlow, unwrapShell } from '../src/flow/codex-flow.js';

// Shaped like Codex SDK thread items (item.completed payloads).
// Hand-built: replace with recorded transcripts from `npm run test:contract` once keys are available.
const workdir = path.join(os.tmpdir(), 'iointel-eval-c0dex', 'work');
const fwd = workdir.replaceAll('\\', '/');
const cmd = (command: string, exit_code = 0) => ({ id: 'x', type: 'command_execution', command, exit_code, aggregated_output: '', status: 'completed' });

const items = [
  cmd("bash -lc 'ls -la && cat .agents/skills/io-intelligence/SKILL.md'"),
  cmd("bash -lc \"sed -n '1,200p' .agents/skills/io-intelligence/references/core.md\""),
  cmd(`"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content -Raw '${workdir}\\package.json'"`),
  { id: 'w', type: 'web_search', query: 'io.Intelligence mcp-web' },
  cmd(`bash -lc 'node .agents/skills/io-intelligence/scripts/materialize-template.mjs --template ai-web-vanilla --target ${fwd}/app'`),
  { id: 'f', type: 'file_change', status: 'completed', changes: [{ path: `${workdir}\\src\\tool.ts`, kind: 'add' }] },
  cmd("bash -lc 'npm run build'", 1),
  { id: 'm', type: 'agent_message', text: 'Done.' },
];

describe('Codex flow extractor', () => {
  it('maps items to normalized steps, turning shell reads into read steps', () => {
    const flow = extractCodexFlow(items, workdir, '.agents/skills/io-intelligence');

    expect(flow.skillTriggered).toBe(true);
    expect(flow.steps).toEqual([
      { kind: 'skill-loaded', skill: 'io-intelligence', via: 'skill-md-read' },
      { kind: 'read', path: '<skill>/references/core.md' },
      { kind: 'read', path: 'package.json' },
      { kind: 'fetch', url: 'search: io.Intelligence mcp-web' },
      { kind: 'script', name: 'materialize-template', args: ['--template', 'ai-web-vanilla', '--target', 'app'] },
      { kind: 'write', path: 'src/tool.ts' },
      { kind: 'command', command: 'npm run build', exitCode: 1 },
    ]);
  });

  it('only counts a read of the installed skill SKILL.md as triggering', () => {
    const notTriggered = extractCodexFlow(
      [cmd("bash -lc 'cat README.md'"), cmd("bash -lc 'rg SKILL.md'")],
      workdir,
      '.agents/skills/io-intelligence',
    );

    expect(notTriggered.skillTriggered).toBe(false);
    expect(notTriggered.steps).toEqual([{ kind: 'read', path: 'README.md' }]);
  });

  it('unwraps bash and PowerShell wrappers', () => {
    expect(unwrapShell("/bin/bash -lc 'npm test'")).toBe('npm test');
    expect(unwrapShell('pwsh.exe -NoProfile -Command "npm test"')).toBe('npm test');
    expect(unwrapShell('npm test')).toBe('npm test');
  });
});

describe('Codex cost', () => {
  const usage = { input_tokens: 1_000_000, cached_input_tokens: 400_000, cache_write_input_tokens: 0, output_tokens: 100_000, reasoning_output_tokens: 0 };

  it('is unknown without configured prices', () => {
    expect(codexCost(usage, {})).toBeNull();
  });

  it('prices uncached input, cached input and output', () => {
    const env = { CODEX_PRICE_INPUT_PER_MTOK: '2', CODEX_PRICE_CACHED_INPUT_PER_MTOK: '0.5', CODEX_PRICE_OUTPUT_PER_MTOK: '10' };
    expect(codexCost(usage, env)).toBeCloseTo(0.6 * 2 + 0.4 * 0.5 + 0.1 * 10);
  });
});
