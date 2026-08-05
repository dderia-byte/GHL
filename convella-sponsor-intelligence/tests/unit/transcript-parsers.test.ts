import { describe, expect, it } from "vitest";
import { parseSrt } from "@/lib/transcript/parsers/srt";
import { parseVtt } from "@/lib/transcript/parsers/vtt";
import { parseTxt } from "@/lib/transcript/parsers/txt";

describe("parseSrt", () => {
  it("parses standard SRT cues", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:04,500 --> 00:00:07,000
Second line`;

    const segments = parseSrt(srt);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ text: "Hello world", startSeconds: 1, durationSeconds: 3 });
    expect(segments[1].startSeconds).toBeCloseTo(4.5);
  });

  it("strips inline formatting tags", () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\n<b>Bold</b> text`;
    expect(parseSrt(srt)[0].text).toBe("Bold text");
  });

  it("tolerates missing sequence numbers", () => {
    const srt = `00:00:00,000 --> 00:00:02,000\nNo index line`;
    expect(parseSrt(srt)).toHaveLength(1);
  });

  it("returns an empty array for unparseable content", () => {
    expect(parseSrt("not a transcript at all")).toHaveLength(0);
  });
});

describe("parseVtt", () => {
  it("parses WebVTT cues and skips the header", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:04.500 --> 00:00:07.000
Second line`;

    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe("Hello world");
    expect(segments[0].startSeconds).toBe(1);
  });

  it("skips NOTE blocks", () => {
    const vtt = `WEBVTT

NOTE this is a comment

00:00:00.000 --> 00:00:01.000
Actual cue`;
    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Actual cue");
  });

  it("handles cue identifiers before the timecode line", () => {
    const vtt = `WEBVTT

cue-1
00:00:00.000 --> 00:00:01.000
Identified cue`;
    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Identified cue");
  });
});

describe("parseTxt", () => {
  it("parses lines with leading timestamps", () => {
    const txt = `[00:12] First line\n[01:05] Second line`;
    const segments = parseTxt(txt);
    expect(segments[0]).toEqual({ text: "First line", startSeconds: 12, durationSeconds: null });
    expect(segments[1].startSeconds).toBe(65);
  });

  it("keeps a null timestamp for plain lines", () => {
    const segments = parseTxt("Just some plain text\nAnother line");
    expect(segments[0].startSeconds).toBeNull();
    expect(segments[1].startSeconds).toBeNull();
  });

  it("skips blank lines", () => {
    const segments = parseTxt("Line one\n\n\nLine two");
    expect(segments).toHaveLength(2);
  });
});
