function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeClassLabel(value: unknown): string {
  const rawValue = String(value || "").trim().replace(/\s+/g, " ");

  if (!rawValue) {
    return "";
  }

  const numericMatch = rawValue.match(/\d+/);

  if (numericMatch) {
    return `Class ${Number.parseInt(numericMatch[0], 10)}`;
  }

  if (/^class\s+/i.test(rawValue)) {
    return rawValue.replace(/^class\s+/i, "Class ");
  }

  return rawValue;
}

export function buildClassMatcher(value: unknown): RegExp | null {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const numericMatch = rawValue.match(/\d+/);

  if (numericMatch) {
    return new RegExp(`^(?:class\\s*)?${escapeRegExp(numericMatch[0])}$`, "i");
  }

  const normalizedValue = normalizeClassLabel(rawValue);
  return new RegExp(`^${escapeRegExp(normalizedValue)}$`, "i");
}
