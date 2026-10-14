import type { TextReplacement } from "@/bindings";

export const normalizeDictionary = (
  entries: TextReplacement[],
): TextReplacement[] => {
  if (entries.length > 1000) throw new Error("tooManyEntries");
  const seen = new Set<string>();
  return entries.map(({ from, to }) => {
    if (typeof from !== "string" || typeof to !== "string") {
      throw new Error("invalidEntry");
    }
    const entry = { from: from.trim(), to: to.trim() };
    if (
      !entry.from ||
      !entry.to ||
      [entry.from, entry.to].some(
        (value) =>
          Array.from(value).length > 64 || /[\u0000-\u001f\u007f]/.test(value),
      )
    ) {
      throw new Error("invalidEntry");
    }
    if (seen.has(entry.from)) throw new Error("duplicate");
    seen.add(entry.from);
    return entry;
  });
};

export const importDictionary = (
  content: string,
  current: TextReplacement[],
): TextReplacement[] => {
  const parsed: unknown = JSON.parse(content);
  let entries: TextReplacement[];
  if (Array.isArray(parsed)) {
    if (
      parsed.some(
        (entry) =>
          typeof entry !== "object" ||
          entry === null ||
          typeof entry.from !== "string" ||
          typeof entry.to !== "string",
      )
    ) {
      throw new Error("invalidEntry");
    }
    entries = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    entries = Object.entries(parsed).map(([from, to]) => {
      if (typeof to !== "string") throw new Error("invalidEntry");
      return { from, to };
    });
  } else {
    throw new Error("invalidEntry");
  }
  const merged = new Map(current.map((entry) => [entry.from, entry]));
  for (const entry of normalizeDictionary(entries)) {
    merged.set(entry.from, entry);
  }
  return normalizeDictionary([...merged.values()]);
};
