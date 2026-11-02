import type { FlowStep } from '../types.js';
import { describeStep } from './normalize.js';

export function flowKey(steps: FlowStep[]): string {
  return JSON.stringify(steps);
}

/**
 * Groups repeats by identical flows. Runs outside the largest group are odd
 * (ties go to the group seen first). Returns indices into `flows`.
 */
export function findOddRuns(flows: FlowStep[][]): { majority: number[]; odd: number[] } {
  const groups = new Map<string, number[]>();
  flows.forEach((steps, i) => {
    const key = flowKey(steps);
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });
  let majority: number[] = [];
  for (const members of groups.values()) if (members.length > majority.length) majority = members;
  const odd = flows.map((_, i) => i).filter((i) => !majority.includes(i));
  return { majority, odd };
}

export interface FlowDiff {
  added: string[];
  removed: string[];
}

/** Step-level diff (longest common subsequence) between a baseline flow and a current flow. */
export function diffFlows(baseline: FlowStep[], current: FlowStep[]): FlowDiff {
  const a = baseline.map(describeStep);
  const b = current.map(describeStep);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);

  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) removed.push(a[i++]!);
    else added.push(b[j++]!);
  }
  removed.push(...a.slice(i));
  added.push(...b.slice(j));
  return { added, removed };
}

export function isEmptyDiff(d: FlowDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0;
}
