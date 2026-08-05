import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const ORIGINAL_ENV = { ...process.env };
const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
    },
  };
});

const schema = z.object({ ok: z.boolean() });

describe("callAnthropicStructured (mocked Anthropic SDK)", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("parses a valid structured JSON reply", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: '{"ok": true}' }] });

    const { callAnthropicStructured } = await import("@/lib/anthropic/client");
    const result = await callAnthropicStructured("system", "user prompt", schema);

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with a corrective message after malformed JSON, then succeeds", async () => {
    createMock
      .mockResolvedValueOnce({ content: [{ type: "text", text: "not json" }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{"ok": true}' }] });

    const { callAnthropicStructured } = await import("@/lib/anthropic/client");
    const result = await callAnthropicStructured("system", "user prompt", schema);

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(2);
    const secondCallPrompt = createMock.mock.calls[1][0].messages[0].content as string;
    expect(secondCallPrompt).toContain("could not be parsed");
  });

  it("throws after repeated malformed responses instead of returning invented data", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "still not json" }] });

    const { callAnthropicStructured } = await import("@/lib/anthropic/client");
    await expect(callAnthropicStructured("system", "user prompt", schema)).rejects.toThrow();
  });

  it("throws AnthropicNotConfiguredError when no API key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { callAnthropicStructured, AnthropicNotConfiguredError } = await import("@/lib/anthropic/client");
    await expect(callAnthropicStructured("system", "user", schema)).rejects.toBeInstanceOf(AnthropicNotConfiguredError);
  });
});
