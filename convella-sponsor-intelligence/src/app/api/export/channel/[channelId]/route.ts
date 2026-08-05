import { NextResponse } from "next/server";
import { getChannelExportRecords } from "@/lib/csv/queries";
import { buildDetectionsCsv } from "@/lib/csv/detections-export";

export async function GET(_request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const records = await getChannelExportRecords(channelId);
  const csv = buildDetectionsCsv(records);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="channel-${channelId}-sponsorships.csv"`,
    },
  });
}
