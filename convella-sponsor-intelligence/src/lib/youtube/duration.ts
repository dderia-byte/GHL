const ISO_8601_DURATION_PATTERN = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;

/** Parses a YouTube API ISO 8601 duration (e.g. "PT1H2M3S") into whole seconds. */
export function parseIso8601Duration(duration: string): number | null {
  const match = duration.trim().match(ISO_8601_DURATION_PATTERN);
  if (!match) return null;

  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;

  const totalSeconds =
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);

  return Math.round(totalSeconds);
}
