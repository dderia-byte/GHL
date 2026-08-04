import { describe, expect, it } from "vitest";
import { SETTING_DEFINITIONS, resolveSettingValue } from "@/lib/settings/definitions";

describe("resolveSettingValue", () => {
  it("returns the stored value when it validates", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", 10, undefined)).toBe(10);
  });

  it("falls back to the default when nothing is stored and no env is set", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", undefined, undefined)).toBe(40);
    expect(resolveSettingValue("budgets.dailyCostLimitUsd", undefined, undefined)).toBe(25);
  });

  it("uses the env fallback (coerced) when no row is stored", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", undefined, "12")).toBe(12);
    expect(resolveSettingValue("budgets.dailyCostLimitUsd", undefined, "3.5")).toBe(3.5);
  });

  it("prefers the stored row over the env fallback", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", 7, "12")).toBe(7);
  });

  it("rejects a stored value beyond the hard bound and falls through", () => {
    // 2500 exceeds the max(200) hard bound — the row is treated as absent.
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", 2500, undefined)).toBe(40);
    // ...and the env fallback is consulted next.
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", 2500, "40")).toBe(40);
  });

  it("rejects a malformed stored value (wrong type) and falls back", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", "lots", undefined)).toBe(40);
    expect(resolveSettingValue("discovery.allowHiddenSubscriberCounts", "yes", undefined)).toBe(false);
  });

  it("rejects an env fallback beyond the hard bound and uses the default", () => {
    // 99 exceeds max(10), so the env value is discarded and the default (2) wins.
    expect(resolveSettingValue("discovery.maxPagesPerQuery", undefined, "99")).toBe(2);
  });

  it("coerces boolean env values", () => {
    expect(resolveSettingValue("discovery.allowHiddenSubscriberCounts", undefined, "true")).toBe(true);
    expect(resolveSettingValue("discovery.allowHiddenSubscriberCounts", undefined, "false")).toBe(false);
    expect(resolveSettingValue("discovery.allowHiddenSubscriberCounts", undefined, "banana")).toBe(false);
  });

  it("treats an empty env string as unset", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", undefined, "")).toBe(40);
  });

  it("boundary: a value exactly at the hard bound passes", () => {
    expect(resolveSettingValue("discovery.maxCreatorsPerRun", 200, undefined)).toBe(200);
    expect(resolveSettingValue("discovery.maxPagesPerQuery", 5, undefined)).toBe(5);
  });

  it("defaults the qualified target to 30 and the candidate ceiling to 150", () => {
    expect(resolveSettingValue("discovery.qualifiedTarget", undefined, undefined)).toBe(30);
    expect(resolveSettingValue("discovery.maxCandidatesPerRun", undefined, undefined)).toBe(150);
  });

  it("every definition's default validates against its own schema", () => {
    for (const definition of Object.values(SETTING_DEFINITIONS)) {
      const parsed = definition.schema.safeParse(definition.defaultValue);
      expect(parsed.success, `default for ${definition.key} must satisfy its schema`).toBe(true);
    }
  });
});
