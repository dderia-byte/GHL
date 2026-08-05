import { NextResponse } from "next/server";
import { getBrandExportRecords } from "@/lib/csv/queries";
import { buildDetectionsCsv } from "@/lib/csv/detections-export";

export async function GET(_request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const records = await getBrandExportRecords(brandId);
  const csv = buildDetectionsCsv(records);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="brand-${brandId}-sponsorships.csv"`,
    },
  });
}
