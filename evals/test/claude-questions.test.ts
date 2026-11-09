import { describe, expect, it } from "vitest";
import { answerQuestions } from "../src/adapters/claude-questions.js";

describe("answerQuestions", () => {
  it("answers every question with the reply and keeps the original input", () => {
    const input = {
      questions: [
        { question: "How should the WASM file be delivered?", header: "WASM" },
        { question: "Any tool policies?", header: "Policies" },
      ],
    };
    expect(answerQuestions(input, "Use your recommended defaults.")).toEqual({
      ...input,
      answers: {
        "How should the WASM file be delivered?":
          "Use your recommended defaults.",
        "Any tool policies?": "Use your recommended defaults.",
      },
    });
  });

  it("returns empty answers when the input has no usable questions", () => {
    expect(answerQuestions({}, "ok")).toEqual({ answers: {} });
    expect(answerQuestions({ questions: [null, { header: "x" }] }, "ok")).toEqual(
      { questions: [null, { header: "x" }], answers: {} },
    );
  });
});
