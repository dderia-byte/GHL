import { describe, expect, it } from "vitest";
import { parseYouTubeInput, buildTimestampedVideoUrl, YouTubeInputParseError } from "@/lib/youtube/parse";
import { parseIso8601Duration } from "@/lib/youtube/duration";

describe("parseYouTubeInput", () => {
  it("parses a channel URL with /channel/", () => {
    const result = parseYouTubeInput("https://www.youtube.com/channel/UC1234567890123456789012");
    expect(result).toEqual({ type: "channel", ref: { kind: "channel_id", value: "UC1234567890123456789012" } });
  });

  it("parses an @handle URL", () => {
    const result = parseYouTubeInput("https://www.youtube.com/@convella_demo");
    expect(result).toEqual({ type: "channel", ref: { kind: "handle", value: "@convella_demo" } });
  });

  it("parses a bare @handle", () => {
    const result = parseYouTubeInput("@convella_demo");
    expect(result).toEqual({ type: "channel", ref: { kind: "handle", value: "@convella_demo" } });
  });

  it("parses a bare channel ID", () => {
    const result = parseYouTubeInput("UC1234567890123456789012");
    expect(result).toEqual({ type: "channel", ref: { kind: "channel_id", value: "UC1234567890123456789012" } });
  });

  it("parses a legacy /user/ URL as a username reference", () => {
    const result = parseYouTubeInput("https://www.youtube.com/user/SomeLegacyUser");
    expect(result).toEqual({ type: "channel", ref: { kind: "username", value: "SomeLegacyUser" } });
  });

  it("parses a watch URL", () => {
    const result = parseYouTubeInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s");
    expect(result).toEqual({ type: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("parses a youtu.be short URL", () => {
    const result = parseYouTubeInput("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toEqual({ type: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("parses a shorts URL", () => {
    const result = parseYouTubeInput("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(result).toEqual({ type: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("parses a bare video ID", () => {
    const result = parseYouTubeInput("dQw4w9WgXcQ");
    expect(result).toEqual({ type: "video", videoId: "dQw4w9WgXcQ" });
  });

  it("rejects empty input", () => {
    expect(() => parseYouTubeInput("")).toThrow(YouTubeInputParseError);
  });

  it("rejects an unrecognisable URL", () => {
    expect(() => parseYouTubeInput("https://example.com/foo")).toThrow(YouTubeInputParseError);
  });

  it("rejects garbage text", () => {
    expect(() => parseYouTubeInput("not a valid anything!!")).toThrow(YouTubeInputParseError);
  });
});

describe("buildTimestampedVideoUrl", () => {
  it("builds a URL with a timestamp", () => {
    expect(buildTimestampedVideoUrl("abc12345678", 132)).toBe("https://www.youtube.com/watch?v=abc12345678&t=132s");
  });

  it("omits the timestamp when null", () => {
    expect(buildTimestampedVideoUrl("abc12345678", null)).toBe("https://www.youtube.com/watch?v=abc12345678");
  });

  it("never fabricates a timestamp for negative input", () => {
    expect(buildTimestampedVideoUrl("abc12345678", -5)).toBe("https://www.youtube.com/watch?v=abc12345678");
  });
});

describe("parseIso8601Duration", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseIso8601Duration("PT1H2M3S")).toBe(3723);
  });

  it("parses minutes only", () => {
    expect(parseIso8601Duration("PT15M")).toBe(900);
  });

  it("parses seconds only", () => {
    expect(parseIso8601Duration("PT45S")).toBe(45);
  });

  it("parses days", () => {
    expect(parseIso8601Duration("P1DT1H")).toBe(90000);
  });

  it("returns null for malformed input", () => {
    expect(parseIso8601Duration("not-a-duration")).toBeNull();
  });
});
