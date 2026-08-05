import { createHash } from "node:crypto";

/** Stable content hash used to detect whether description/transcript content has materially changed since the last analysis run. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}
