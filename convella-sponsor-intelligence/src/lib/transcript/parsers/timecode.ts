/** Parses "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" / "MM:SS.mmm" (VTT) into seconds. */
export function parseTimecodeToSeconds(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  const match = trimmed.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
  if (!match) return null;

  const [, hoursPart, minutesPart, secondsPart, fractionPart] = match;
  const hours = hoursPart ? Number(hoursPart) : 0;
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);
  const fraction = fractionPart ? Number(`0.${fractionPart}`) : 0;

  if ([hours, minutes, seconds].some((n) => Number.isNaN(n))) return null;

  return hours * 3600 + minutes * 60 + seconds + fraction;
}
