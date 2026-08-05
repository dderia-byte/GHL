"use server";

import { revalidatePath } from "next/cache";
import {
  DiscoveryConflictError,
  cancelDiscoveryRun,
  pauseDiscoveryRun,
  resumeDiscoveryRun,
  startDiscoveryRun,
} from "@/lib/discovery/service";

export interface DiscoveryActionState {
  error?: string;
}

function toState(error: unknown): DiscoveryActionState {
  if (error instanceof DiscoveryConflictError) return { error: error.message };
  return { error: error instanceof Error ? error.message : "Something went wrong. Please try again." };
}

export async function startDiscoveryRunAction(): Promise<DiscoveryActionState> {
  try {
    await startDiscoveryRun({ trigger: "manual" });
    revalidatePath("/discovery");
    return {};
  } catch (error) {
    return toState(error);
  }
}

export async function pauseRunAction(runId: string): Promise<DiscoveryActionState> {
  try {
    await pauseDiscoveryRun(runId);
    revalidatePath("/discovery");
    return {};
  } catch (error) {
    return toState(error);
  }
}

export async function resumeRunAction(runId: string): Promise<DiscoveryActionState> {
  try {
    await resumeDiscoveryRun(runId);
    revalidatePath("/discovery");
    return {};
  } catch (error) {
    return toState(error);
  }
}

export async function cancelRunAction(runId: string): Promise<DiscoveryActionState> {
  try {
    await cancelDiscoveryRun(runId);
    revalidatePath("/discovery");
    return {};
  } catch (error) {
    return toState(error);
  }
}
