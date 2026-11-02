import { access } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeAdapter, fakeJudge, makeEnv, runEval, SKILL_INSTALL } from './helpers.js';

describe('--baseline (skill removed)', () => {
  it('adds a skill-removed run per unit, without the skill installed, and reports it apart', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'uplift', kind: 'answer', targets: ['fake/m'], prompt: 'p', mustInclude: ['mcp-web'] });
    const adapter = fakeAdapter(async (input) => {
      const installed = await access(path.join(input.workdir, SKILL_INSTALL)).then(
        () => true,
        () => false,
      );
      return { skillTriggered: installed, finalMessage: installed ? 'use mcp-web' : 'use some MCP package' };
    });

    const report = await runEval(env.options({ repeat: 2, withoutSkill: true }), env.deps({ adapters: { fake: adapter } }));

    const c = report.cases[0]!;
    expect(adapter.calls).toHaveLength(4);
    expect(c).toMatchObject({ ran: 2, pass: true, passRate: 1 });
    expect(c.runs.every((r) => r.withSkill)).toBe(true);
    expect(c.withoutSkill).toMatchObject({ ran: 2, passRate: 0, triggerRate: 0 });
    expect(c.withoutSkill!.runs.every((r) => !r.withSkill)).toBe(true);
  });

  it('ignores the trigger expectation for skill-removed runs', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'facts', kind: 'answer', targets: ['fake/m'], prompt: 'p', mustInclude: ['mcp-web'] });
    const adapter = fakeAdapter(() => ({ skillTriggered: false, finalMessage: 'mcp-web' }));

    const report = await runEval(env.options({ withoutSkill: true }), env.deps({ adapters: { fake: adapter } }));

    expect(report.cases[0]!.pass).toBe(false);
    expect(report.cases[0]!.withoutSkill!.passRate).toBe(1);
  });
});

describe('cost cap, concurrency and cost reporting', () => {
  it('stops starting new runs once the cap is reached and marks them skipped', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'a', kind: 'trigger', targets: ['fake/m'], prompt: 'p' });
    const adapter = fakeAdapter(() => ({ costUsd: 0.4 }));

    const report = await runEval(
      env.options({ repeat: 5, concurrency: 1, maxCostUsd: 1 }),
      env.deps({ adapters: { fake: adapter } }),
    );

    expect(adapter.calls).toHaveLength(3);
    expect(report.cases[0]).toMatchObject({ ran: 3, skipped: 2, pass: true });
    expect(report.cases[0]!.runs.filter((r) => r.skipped)[0]!.skipReason).toBe('cost cap of $1 reached');
    expect(report.totals).toMatchObject({ runs: 3, skipped: 2 });
    expect(report.totals.costUsd).toBeCloseTo(1.2);
  });

  it('reports a case as skipped (pass null) when every run was skipped', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'a', kind: 'trigger', targets: ['fake/m'], prompt: 'a' });
    await env.writeCase({ id: 'b', kind: 'trigger', targets: ['fake/m'], prompt: 'b' });
    const adapter = fakeAdapter(() => ({ costUsd: 5 }));

    const report = await runEval(env.options({ concurrency: 1, maxCostUsd: 1 }), env.deps({ adapters: { fake: adapter } }));

    expect(report.cases.find((c) => c.caseId === 'b')!.pass).toBeNull();
  });

  it('runs at most `concurrency` units at once', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'a', kind: 'trigger', targets: ['fake/m'], prompt: 'p' });
    let active = 0;
    let peak = 0;
    const adapter = fakeAdapter(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 50));
      active--;
      return {};
    });

    await runEval(env.options({ repeat: 6, concurrency: 2 }), env.deps({ adapters: { fake: adapter } }));

    expect(peak).toBe(2);
  });

  it('totals agent and judge cost per case, per target and overall, and flags unknown cost', async () => {
    const env = await makeEnv();
    await env.writeCase({ id: 'a', kind: 'answer', targets: ['fake/m', 'nocost/m'], prompt: 'p', rubric: '- line' });
    const fake = fakeAdapter(() => ({ costUsd: 0.25 }));
    const nocost = fakeAdapter(() => ({ costUsd: null }), 'nocost');

    const report = await runEval(env.options({ repeat: 2 }), env.deps({ adapters: { fake, nocost }, judge: fakeJudge(() => false, 0.05) }));

    expect(report.cases.find((c) => c.target === 'fake/m')).toMatchObject({ costUnknown: false });
    expect(report.cases.find((c) => c.target === 'fake/m')!.costUsd).toBeCloseTo(0.6);
    expect(report.cases.find((c) => c.target === 'nocost/m')).toMatchObject({ costUnknown: true });
    expect(report.totals.costByTarget['fake/m']).toBeCloseTo(0.6);
    expect(report.totals.costUnknown).toBe(true);
  });
});
