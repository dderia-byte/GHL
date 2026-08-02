import { NextResponse } from "next/server";
import { getBrandTargetRecords } from "@/lib/csv/target-queries";
import { buildBrandTargetsCsv } from "@/lib/csv/target-export";

export async function GET() {
  const records = await getBrandTargetRecords();
  const csv = buildBrandTargetsCsv(records);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-targets.csv"`,
    },
  });
}
