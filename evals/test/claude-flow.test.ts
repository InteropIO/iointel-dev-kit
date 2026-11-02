import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { extractClaudeFlow } from '../src/flow/claude-flow.js';

// Shaped like Claude Agent SDK messages (assistant tool_use blocks, user tool_result blocks).
// Hand-built: replace with recorded transcripts from `npm run test:contract` once keys are available.
const workdir = path.join(os.tmpdir(), 'iointel-eval-abc123', 'work');
const fwd = workdir.replaceAll('\\', '/');
const skill = `${fwd}/.claude/skills/io-intelligence`;

const assistant = (...blocks: object[]) => ({ type: 'assistant', parent_tool_use_id: null, message: { content: blocks } });
const user = (...blocks: object[]) => ({ type: 'user', parent_tool_use_id: null, message: { content: blocks } });
const use = (id: string, name: string, input: object) => ({ type: 'tool_use', id, name, input });
const result = (id: string, content: string, isError = false) => ({ type: 'tool_result', tool_use_id: id, content, is_error: isError });

const transcript = [
  { type: 'system', subtype: 'init' },
  assistant({ type: 'text', text: 'Loading the skill.' }, use('t1', 'Skill', { skill: 'io-intelligence' })),
  user(result('t1', 'Launching skill: io-intelligence')),
  assistant(use('t2', 'Read', { file_path: `${skill}/references/core.md` })),
  user(result('t2', '...')),
  assistant(use('t3', 'Read', { file_path: `${workdir}\\package.json` }), use('t4', 'Glob', { pattern: '**/*.ts' })),
  user(result('t3', '{}'), result('t4', 'src/a.ts')),
  assistant(use('t5', 'WebFetch', { url: 'https://docs-ai.interop.io/llms.txt', prompt: 'x' })),
  user(result('t5', '...')),
  assistant(
    use('t6', 'Bash', {
      command: `node ${skill}/scripts/materialize-template.mjs --template io-assist-react-packaged --target ${fwd}/app`,
    }),
  ),
  user(result('t6', 'done')),
  assistant(use('t7', 'Write', { file_path: `${workdir}\\src\\tool.ts`, content: 'x' })),
  user(result('t7', 'ok')),
  assistant(use('t8', 'Bash', { command: `cd ${fwd} && npm run build` })),
  user(result('t8', 'Exit code 2\nerror TS2304', true)),
  assistant(use('t9', 'Edit', { file_path: `${fwd}/src/tool.ts`, old_string: 'a', new_string: 'b' })),
  user(result('t9', 'ok')),
  assistant(use('t10', 'Bash', { command: 'npm run build' })),
  user(result('t10', 'built')),
  { type: 'result', subtype: 'success', result: 'Done.', num_turns: 10, total_cost_usd: 0.42 },
];

describe('Claude flow extractor', () => {
  it('maps tool calls to normalized key steps', () => {
    const flow = extractClaudeFlow(transcript, workdir, '.claude/skills/io-intelligence');

    expect(flow.skillTriggered).toBe(true);
    expect(flow.steps).toEqual([
      { kind: 'skill-loaded', skill: 'io-intelligence', via: 'skill-tool' },
      { kind: 'read', path: '<skill>/references/core.md' },
      { kind: 'read', path: 'package.json' },
      { kind: 'fetch', url: 'https://docs-ai.interop.io/llms.txt' },
      { kind: 'script', name: 'materialize-template', args: ['--template', 'io-assist-react-packaged', '--target', 'app'] },
      { kind: 'write', path: 'src/tool.ts' },
      { kind: 'command', command: 'cd . && npm run build', exitCode: 2 },
      { kind: 'write', path: 'src/tool.ts' },
      { kind: 'command', command: 'npm run build', exitCode: 0 },
    ]);
  });

  it('produces identical steps for the same route in a different temp folder', () => {
    const otherWorkdir = path.join(os.tmpdir(), 'iointel-eval-zzz999', 'work');
    const moved = JSON.parse(
      JSON.stringify(transcript)
        .replaceAll(JSON.stringify(fwd).slice(1, -1), JSON.stringify(otherWorkdir.replaceAll('\\', '/')).slice(1, -1))
        .replaceAll(JSON.stringify(workdir).slice(1, -1), JSON.stringify(otherWorkdir).slice(1, -1)),
    );

    expect(extractClaudeFlow(moved, otherWorkdir, '.claude/skills/io-intelligence').steps).toEqual(
      extractClaudeFlow(transcript, workdir, '.claude/skills/io-intelligence').steps,
    );
  });

  it('does not count other skills or a plain SKILL.md read as triggering', () => {
    const other = [
      assistant(use('a', 'Skill', { skill: 'pdf' })),
      assistant(use('b', 'Read', { file_path: `${skill}/SKILL.md` })),
    ];

    const flow = extractClaudeFlow(other, workdir, '.claude/skills/io-intelligence');

    expect(flow.skillTriggered).toBe(false);
    expect(flow.steps).toEqual([
      { kind: 'skill-loaded', skill: 'pdf', via: 'skill-tool' },
      { kind: 'read', path: '<skill>/SKILL.md' },
    ]);
  });
});
