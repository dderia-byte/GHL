import { describe, expect, it } from "vitest";
import { domainMatchesBrand, findMatchingBrand, slugifyBrandToken } from "@/lib/brand/normalize";

describe("slugifyBrandToken", () => {
  it("lowercases and strips punctuation", () => {
    expect(slugifyBrandToken("Code Rabbit")).toBe("coderabbit");
    expect(slugifyBrandToken("CodeRabbit")).toBe("coderabbit");
  });

  it("strips common legal suffixes", () => {
    expect(slugifyBrandToken("Acme Corp")).toBe("acme");
    expect(slugifyBrandToken("Acme Inc.")).toBe("acme");
    expect(slugifyBrandToken("Acme, LLC")).toBe("acme");
  });
});

describe("domainMatchesBrand", () => {
  it("matches a domain label to its brand name", () => {
    expect(domainMatchesBrand("coderabbit.ai", "CodeRabbit")).toBe(true);
    expect(domainMatchesBrand("coderabbit.ai", "Code Rabbit")).toBe(true);
  });

  it("does not match unrelated domains", () => {
    expect(domainMatchesBrand("acme.com", "CodeRabbit")).toBe(false);
  });
});

describe("findMatchingBrand", () => {
  const existing = [
    { id: "1", canonicalName: "CodeRabbit", domain: "coderabbit.ai", aliases: ["Code Rabbit"] },
    { id: "2", canonicalName: "Acme Corp", domain: null, aliases: [] },
  ];

  it("matches by domain even if the raw name differs slightly", () => {
    const match = findMatchingBrand("Code Rabbit", "coderabbit.ai", existing);
    expect(match?.id).toBe("1");
  });

  it("matches by alias when no domain is given", () => {
    const match = findMatchingBrand("Code Rabbit", null, existing);
    expect(match?.id).toBe("1");
  });

  it("does not fuzzily match an unrelated brand name", () => {
    const match = findMatchingBrand("Warp", null, existing);
    expect(match).toBeNull();
  });

  it("does not assume Claude refers to an existing Anthropic-domain brand without evidence", () => {
    const brandsWithAnthropic = [{ id: "3", canonicalName: "Anthropic", domain: "anthropic.com", aliases: [] }];
    const match = findMatchingBrand("Claude", null, brandsWithAnthropic);
    expect(match).toBeNull();
  });
});
