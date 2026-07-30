import { NextResponse } from "next/server";
import { getAllExportRecords } from "@/lib/csv/queries";
import { buildDetectionsCsv } from "@/lib/csv/detections-export";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reviewStatus = url.searchParams.get("reviewStatus") ?? undefined;
  const records = await getAllExportRecords(reviewStatus);
  const csv = buildDetectionsCsv(records);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sponsorships.csv"`,
    },
  });
}
