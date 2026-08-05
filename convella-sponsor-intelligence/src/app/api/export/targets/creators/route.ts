import { NextResponse } from "next/server";
import { getCreatorTargetRecords } from "@/lib/csv/target-queries";
import { buildCreatorTargetsCsv } from "@/lib/csv/target-export";

export async function GET() {
  const records = await getCreatorTargetRecords();
  const csv = buildCreatorTargetsCsv(records);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creator-targets.csv"`,
    },
  });
}
