/** Strips markdown code fences and surrounding prose so a model reply can be JSON.parsed. */
export function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const trimmed = candidate.trim();

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length === 0) return trimmed;

  const start = Math.min(...starts);
  const openChar = trimmed[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(closeChar);
  if (end === -1 || end <= start) return trimmed;

  return trimmed.slice(start, end + 1);
}
