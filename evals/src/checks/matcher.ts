const REGEX_SOURCE = /^\/(.+)\/([a-z]*)$/s;

/** A case-file matcher: "/pattern/flags" is a regex, anything else is a case-sensitive substring. */
export function compileMatcher(source: string): (text: string) => boolean {
  const re = REGEX_SOURCE.exec(source);
  if (re) {
    // g and y make RegExp.test stateful across calls, so they are dropped.
    const regex = new RegExp(re[1]!, re[2]!.replace(/[gy]/g, ""));
    return (text) => regex.test(text);
  }
  return (text) => text.includes(source);
}

/** Returns an error message when a "/pattern/flags" matcher is not a valid regex. */
export function matcherError(source: string): string | undefined {
  const re = REGEX_SOURCE.exec(source);
  if (!re) return undefined;
  try {
    new RegExp(re[1]!, re[2]);
    return undefined;
  } catch (err) {
    return `invalid regex ${source}: ${(err as Error).message}`;
  }
}
