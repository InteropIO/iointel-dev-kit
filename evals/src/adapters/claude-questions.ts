/**
 * Answers an AskUserQuestion call with the case's scripted reply, standing in for the user an eval
 * run does not have. Every question in the call gets the same reply, as free text (the "Other"
 * answer), so the reply can pick an option by label or say anything else.
 */
export function answerQuestions(
  toolInput: Record<string, unknown>,
  reply: string,
): Record<string, unknown> {
  const questions = Array.isArray(toolInput.questions)
    ? toolInput.questions
    : [];
  const answers: Record<string, string> = {};
  for (const q of questions) {
    const text = (q as { question?: unknown } | null)?.question;
    if (typeof text === "string") answers[text] = reply;
  }
  return { ...toolInput, answers };
}
