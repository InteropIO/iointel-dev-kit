import { describe, expect, it } from 'vitest';
import { fakeAdapter, fakeJudge, makeEnv, runEval } from './helpers.js';

const answer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'answer',
  targets: ['fake/m'],
  prompt: 'How do I expose a tool to io.Assist?',
  ...extra,
});

describe('answer cases', () => {
  it('checks mustInclude and mustNotInclude with strings and regexes', async () => {
    const env = await makeEnv();
    await env.writeCase(
      answer('good', {
        prompt: 'good',
        mustInclude: ['@interopio/mcp-web', '/register\\w*Tool/i'],
        mustNotInclude: ['@interopio/mcp-server'],
      }),
    );
    await env.writeCase(answer('invented', { prompt: 'invented', mustNotInclude: ['/@interopio\\/mcp-(server|browser)/'] }));
    const adapter = fakeAdapter((input) => ({
      finalMessage:
        input.prompt === 'invented'
          ? 'Use @interopio/mcp-browser and call registerTool.'
          : 'Install @interopio/mcp-web, then RegisterTool at startup.',
    }));

    const report = await runEval(env.options({ concurrency: 1 }), env.deps({ adapters: { fake: adapter } }));

    const good = report.cases.find((c) => c.caseId === 'good')!;
    const invented = report.cases.find((c) => c.caseId === 'invented')!;
    expect(good.pass).toBe(true);
    expect(invented.pass).toBe(false);
    expect(invented.runs[0]!.checks.find((c) => !c.pass)).toMatchObject({
      name: 'mustNotInclude /@interopio\\/mcp-(server|browser)/',
      detail: 'found in the final message',
    });
  });

  it('fails a run when the skill did not trigger, even if the text is right', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('ignored-skill', { mustInclude: ['mcp-web'] }));
    const adapter = fakeAdapter(() => ({ skillTriggered: false, finalMessage: 'use mcp-web' }));

    const report = await runEval(env.options(), env.deps({ adapters: { fake: adapter } }));

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]!.checks[0]).toEqual({ name: 'skill triggered', pass: false });
  });

  it('requires every run to pass', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('mostly', { mustInclude: ['mcp-web'] }));
    const adapter = fakeAdapter((_, call) => ({ finalMessage: call === 2 ? 'no idea' : 'mcp-web' }));

    const report = await runEval(env.options({ repeat: 3, concurrency: 1 }), env.deps({ adapters: { fake: adapter } }));

    expect(report.cases[0]).toMatchObject({ pass: false, passRate: 2 / 3, threshold: 1 });
  });

  it('passes the network flag to the adapter (default on)', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('online'));
    await env.writeCase(answer('offline', { network: false }));
    const adapter = fakeAdapter();

    const report = await runEval(env.options({ concurrency: 1 }), env.deps({ adapters: { fake: adapter } }));

    expect(adapter.calls.map((c) => c.network).sort()).toEqual([false, true]);
    expect(report.cases.find((c) => c.caseId === 'offline')!.network).toBe(false);
  });
});

describe('judge', () => {
  it('grades each rubric line and fails the run when any line fails', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('graded', { rubric: '- Recommends mcp-web\n- Explains discovery\n\n' }));
    const judge = fakeJudge((line) => line === 'Explains discovery');
    const adapter = fakeAdapter(() => ({ finalMessage: 'the answer', transcript: [{ tool: 'Read' }] }));

    const report = await runEval(env.options(), env.deps({ adapters: { fake: adapter }, judge }));

    expect(judge.calls[0]).toMatchObject({
      rubric: ['Recommends mcp-web', 'Explains discovery'],
      finalMessage: 'the answer',
      transcript: [{ tool: 'Read' }],
    });
    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.runs[0]!.judge).toEqual([
      { text: 'Recommends mcp-web', pass: true, reason: 'ok' },
      { text: 'Explains discovery', pass: false, reason: 'missed' },
    ]);
    expect(report.cases[0]!.costUsd).toBeCloseTo(0.15);
  });

  it('is not called when deterministic checks already failed', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('cheap-fail', { mustInclude: ['mcp-web'], rubric: '- anything' }));
    const judge = fakeJudge();

    const report = await runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() }, judge }));

    expect(judge.calls).toHaveLength(0);
    expect(report.cases[0]!.pass).toBe(false);
  });

  it('must be configured when a case has a rubric', async () => {
    const env = await makeEnv();
    await env.writeCase(answer('needs-judge', { rubric: '- x' }));

    await expect(runEval(env.options(), env.deps({ adapters: { fake: fakeAdapter() } }))).rejects.toThrow(/no judge/);
  });
});
