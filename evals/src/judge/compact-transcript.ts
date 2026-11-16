// Turns an agent's raw transcript (Claude Agent SDK messages or Codex events) into the compact,
// readable log the judge grades from. The saved transcript file is never changed: this is only
// what the judge reads, and the judge-input file records it exactly as sent.
//
// Three layers, applied in order:
//   1. Compact: keep prompts, the agent's text and thinking, tool calls and tool results, in order.
//      Drop duplicates (tool_use_result, wire_tool_inputs), ids, usage, timestamps and status events.
//   2. Per-entry caps: one huge tool result (a big file read, npm output) is shortened to its start
//      and end, so it can't push everything else out. Tool calls get a far larger cap.
//   3. Budget fallback: if the log is still too long, shorten the OLDEST shortenable entries further,
//      so the end of the run (final edits, build, the agent's own checks) stays intact.
import type { Evals } from "../shared/contracts.js";

type EntryKind =
  | "user"
  | "assistant"
  | "thinking"
  | "tool call"
  | "tool result"
  | "notification"
  | "event";

interface Entry {
  readonly kind: EntryKind;
  /** Shown after the kind, e.g. the tool name and call id. */
  readonly label?: string;
  text: string;
  /** Tool results, synthetic user text and unknown events can be shortened; the agent's own words can't. */
  readonly shortenable: boolean;
}

export interface CompactOptions {
  /** Layer 2: characters kept from the start and end of each tool result. */
  readonly resultHead: number;
  readonly resultTail: number;
  /** Layer 2: the far larger cap for tool calls (a Write's content is also in the diff). */
  readonly callHead: number;
  readonly callTail: number;
  /** Layer 3: total characters the log may take. */
  readonly budget: number;
  /** Layer 3: what an old entry is shortened to when the log is over budget. */
  readonly minHead: number;
  readonly minTail: number;
}

export const DEFAULT_COMPACT_OPTIONS: CompactOptions = {
  resultHead: 4_000,
  resultTail: 2_000,
  callHead: 6_000,
  callTail: 2_000,
  budget: 1_000_000,
  minHead: 400,
  minTail: 200,
};

export interface CompactTranscript {
  readonly text: string;
  readonly stats: Evals.Judge.TranscriptStats;
}

export function compactTranscript(
  events: readonly unknown[],
  options: CompactOptions = DEFAULT_COMPACT_OPTIONS,
): CompactTranscript {
  const rawChars = safeLength(events);
  const entries = events.flatMap(toEntries);

  // Layer 2.
  let entriesShortened = 0;
  for (const e of entries) {
    const [head, tail] =
      e.kind === "tool call"
        ? [options.callHead, options.callTail]
        : e.shortenable
          ? [options.resultHead, options.resultTail]
          : [Infinity, 0];
    const cut = shorten(e.text, head, tail);
    if (cut !== e.text) {
      e.text = cut;
      entriesShortened++;
    }
  }

  // Layer 3: oldest first, so the end of the run is the last thing to lose detail.
  let entriesTrimmed = 0;
  let total = rendered(entries).length;
  for (const e of entries) {
    if (total <= options.budget) break;
    if (!e.shortenable && e.kind !== "tool call") continue;
    const cut = shorten(e.text, options.minHead, options.minTail);
    if (cut === e.text) continue;
    total -= e.text.length - cut.length;
    e.text = cut;
    entriesTrimmed++;
  }

  let text = rendered(entries);
  // Last resort, only for pathological runs made almost entirely of the agent's own text:
  // keep the start for context and most of the budget for the end.
  const lastResort = text.length > options.budget;
  if (lastResort) {
    const head = Math.floor(options.budget * 0.2);
    text = shorten(text, head, options.budget - head);
  }

  return {
    text,
    stats: {
      rawChars,
      sentChars: text.length,
      entries: entries.length,
      entriesShortened,
      entriesTrimmed,
      trimmed: entriesTrimmed > 0 || lastResort,
    },
  };
}

/** Keeps `head` chars from the start and `tail` from the end, with a marker saying how much was cut. */
export function shorten(text: string, head: number, tail: number): string {
  const marker = (n: number) =>
    `\n[… ${n.toLocaleString("en-US")} chars cut …]\n`;
  if (text.length <= head + tail + marker(text.length).length) return text;
  const cut = text.length - head - tail;
  return text.slice(0, head) + marker(cut) + (tail ? text.slice(-tail) : "");
}

function rendered(entries: readonly Entry[]): string {
  return entries
    .map(
      (e, i) =>
        `[#${i + 1}] ${e.kind}${e.label ? ` ${e.label}` : ""}\n${e.text.trimEnd()}`,
    )
    .join("\n\n");
}

// ---- Layer 1: one raw event → zero or more entries ----

type Raw = Record<string, unknown>;

// Status and bookkeeping events that carry no evidence about what the agent did.
const SKIPPED_CLAUDE = new Set([
  "system:init",
  "system:thinking_tokens",
  "system:task_started",
  "system:compact_boundary",
  "rate_limit_event",
  "tool_progress",
  "stream_event",
  "result",
]);
const SKIPPED_CODEX = new Set([
  "thread.started",
  "turn.started",
  "turn.completed",
  "item.started",
  "item.updated",
]);
// Fields that duplicate content or are pure bookkeeping, dropped from events we don't recognise.
const NOISE_KEYS = new Set([
  "uuid",
  "session_id",
  "timestamp",
  "usage",
  "tool_use_result",
  "wire_tool_inputs",
  "tool_result_meta",
  "rate_limit_info",
  "parent_tool_use_id",
  "id",
]);

function toEntries(event: unknown): Entry[] {
  if (!isRecord(event) || typeof event.type !== "string") return [];
  if (isRecord(event.message)) return claudeEntries(event);
  if (event.type === "item.completed" && isRecord(event.item))
    return codexEntries(event.item);
  const key =
    typeof event.subtype === "string"
      ? `${event.type}:${event.subtype}`
      : event.type;
  if (SKIPPED_CLAUDE.has(key) || SKIPPED_CLAUDE.has(event.type)) return [];
  if (SKIPPED_CODEX.has(event.type)) return [];
  if (key === "system:task_notification")
    return [
      {
        kind: "notification",
        label: str(event.tool_use_id),
        text: [str(event.status), str(event.summary)]
          .filter(Boolean)
          .join(": "),
        shortenable: true,
      },
    ];
  if (event.type === "turn.failed" || event.type === "error")
    return [
      {
        kind: "event",
        label: event.type,
        text: JSON.stringify(withoutNoise(event)),
        shortenable: false,
      },
    ];
  return [
    {
      kind: "event",
      label: key,
      text: JSON.stringify(withoutNoise(event)),
      shortenable: true,
    },
  ];
}

function claudeEntries(event: Raw): Entry[] {
  const message = event.message as Raw;
  const content = message.content;
  const role = event.type === "assistant" ? "assistant" : "user";
  // Synthetic user text is injected by the tool (e.g. a loaded skill's content), not typed by anyone.
  const synthetic = event.isSynthetic === true || event.isMeta === true;
  if (typeof content === "string")
    return content.trim()
      ? [
          {
            kind: role,
            ...(synthetic ? { label: "(injected)" } : {}),
            text: content,
            shortenable: synthetic,
          },
        ]
      : [];
  if (!Array.isArray(content)) return [];

  const out: Entry[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type === "text" && typeof block.text === "string") {
      if (block.text.trim())
        out.push({
          kind: role,
          ...(synthetic ? { label: "(injected)" } : {}),
          text: block.text,
          shortenable: synthetic,
        });
    } else if (
      block.type === "thinking" &&
      typeof block.thinking === "string"
    ) {
      if (block.thinking.trim())
        out.push({
          kind: "thinking",
          text: block.thinking,
          shortenable: false,
        });
    } else if (block.type === "tool_use") {
      out.push({
        kind: "tool call",
        label: `${str(block.name)} (${str(block.id)})`,
        text: JSON.stringify(block.input ?? {}),
        shortenable: false,
      });
    } else if (block.type === "tool_result") {
      out.push({
        kind: "tool result",
        label: `(${str(block.tool_use_id)}${block.is_error ? ", error" : ""})`,
        text: toolResultText(block.content),
        shortenable: true,
      });
    }
    // redacted_thinking, images and other blocks carry nothing the judge can read.
  }
  return out;
}

function codexEntries(item: Raw): Entry[] {
  switch (item.type) {
    case "agent_message":
      return [{ kind: "assistant", text: str(item.text), shortenable: false }];
    case "reasoning":
      return [{ kind: "thinking", text: str(item.text), shortenable: false }];
    case "command_execution": {
      const exit =
        typeof item.exit_code === "number" ? `exit ${item.exit_code}` : "";
      return [
        {
          kind: "tool call",
          label: "shell",
          text: str(item.command),
          shortenable: false,
        },
        {
          kind: "tool result",
          label: `(shell${exit ? `, ${exit}` : ""})`,
          text: str(item.aggregated_output),
          shortenable: true,
        },
      ];
    }
    case "file_change":
      return [
        {
          kind: "tool call",
          label: "file_change",
          text: JSON.stringify(item.changes ?? []),
          shortenable: false,
        },
      ];
    case "web_search":
      return [
        {
          kind: "tool call",
          label: "web_search",
          text: str(item.query),
          shortenable: false,
        },
      ];
    case "mcp_tool_call":
      return [
        {
          kind: "tool call",
          label: `${str(item.server)}/${str(item.tool)}`,
          text: JSON.stringify(item.arguments ?? {}),
          shortenable: false,
        },
        {
          kind: "tool result",
          label: `(${str(item.server)}/${str(item.tool)}${item.error ? ", error" : ""})`,
          text: JSON.stringify(item.error ?? item.result ?? null),
          shortenable: true,
        },
      ];
    default:
      return [
        {
          kind: "event",
          label: str(item.type),
          text: JSON.stringify(withoutNoise(item)),
          shortenable: true,
        },
      ];
  }
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((c) =>
        isRecord(c) && typeof c.text === "string"
          ? c.text
          : isRecord(c) && c.type === "image"
            ? "[image]"
            : JSON.stringify(c),
      )
      .join("\n");
  return content === undefined ? "" : JSON.stringify(content);
}

function withoutNoise(value: Raw): Raw {
  return Object.fromEntries(
    Object.entries(value).filter(([k]) => !NOISE_KEYS.has(k)),
  );
}

function isRecord(v: unknown): v is Raw {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string"
    ? v
    : v === undefined || v === null
      ? ""
      : String(v);
}

function safeLength(events: readonly unknown[]): number {
  try {
    return JSON.stringify(events).length;
  } catch {
    return 0;
  }
}
