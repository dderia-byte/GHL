"use server";

import { revalidatePath } from "next/cache";
import {
  pastedTranscriptSchema,
  uploadedTranscriptSchema,
  editDetectionSchema,
  manualDetectionSchema,
} from "@/lib/validation/schemas";
import { ingestPastedTranscript, ingestUploadedTranscript } from "@/lib/transcript/service";
import { detectTranscriptFormat } from "@/lib/transcript/providers/uploaded-file";
import {
  confirmDetection,
  rejectDetection,
  markDetectionOrganic,
  markDetectionAffiliateOnly,
  editDetection,
  addManualDetection,
  markVideoNoSponsor,
} from "@/lib/detections/service";
import { reanalyseVideo, continueAnalysisAfterFirstSponsor } from "@/lib/jobs/actions";

function revalidateVideo(videoId: string) {
  revalidatePath(`/videos/${videoId}`);
}

export interface FormActionState {
  error?: string;
  success?: boolean;
}

export async function submitPastedTranscriptAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = pastedTranscriptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid transcript." };
  await ingestPastedTranscript(parsed.data.videoId, parsed.data.text);
  revalidateVideo(parsed.data.videoId);
  return { success: true };
}

export async function submitUploadedTranscriptAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const file = formData.get("file");
  const videoId = String(formData.get("videoId") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .srt, .vtt, or .txt file to upload." };

  const format = detectTranscriptFormat(file.name);
  if (!format) return { error: "Unsupported file type. Please upload a .srt, .vtt, or .txt file." };

  const content = await file.text();
  const parsed = uploadedTranscriptSchema.safeParse({ videoId, filename: file.name, content });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid upload." };

  await ingestUploadedTranscript(videoId, content, format);
  revalidateVideo(videoId);
  return { success: true };
}

export async function confirmDetectionAction(detectionId: string, videoId: string) {
  await confirmDetection(detectionId);
  revalidateVideo(videoId);
}

export async function rejectDetectionAction(detectionId: string, videoId: string) {
  await rejectDetection(detectionId);
  revalidateVideo(videoId);
}

export async function markOrganicAction(detectionId: string, videoId: string) {
  await markDetectionOrganic(detectionId);
  revalidateVideo(videoId);
}

export async function markAffiliateOnlyAction(detectionId: string, videoId: string) {
  await markDetectionAffiliateOnly(detectionId);
  revalidateVideo(videoId);
}

export async function editDetectionAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = editDetectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid edit." };
  const { detectionId, videoId, ...patch } = parsed.data;
  await editDetection(detectionId, {
    ...patch,
    promotionalUrl: patch.promotionalUrl || null,
  });
  revalidateVideo(videoId);
  return { success: true };
}

export async function addManualDetectionAction(
  _prev: FormActionState | undefined,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = manualDetectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid sponsor details." };
  const data = parsed.data;
  await addManualDetection({
    videoId: data.videoId,
    brandName: data.brandName,
    brandDomain: data.brandDomain || null,
    placementType: data.placementType,
    startTimestampSeconds: data.startTimestampSeconds ?? null,
    endTimestampSeconds: data.endTimestampSeconds ?? null,
    evidenceText: data.evidenceText,
    promotionalUrl: data.promotionalUrl || null,
    discountCode: data.discountCode || null,
    callToAction: data.callToAction || null,
  });
  revalidateVideo(data.videoId);
  return { success: true };
}

export async function markNoSponsorAction(videoId: string) {
  await markVideoNoSponsor(videoId);
  revalidateVideo(videoId);
}

export async function reanalyseVideoAction(videoId: string) {
  await reanalyseVideo(videoId);
  revalidateVideo(videoId);
}

export async function continueAnalysisAction(videoId: string) {
  await continueAnalysisAfterFirstSponsor(videoId);
  revalidateVideo(videoId);
}
