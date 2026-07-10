import React from "react";
import { useVideoConfig } from "remotion";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { Pipeline, PipelineColumn } from "../components/Pipeline";
import { isPortraitComposition, safeMargin } from "../utils/animation";

const columnsWide: PipelineColumn[] = [
  { label: "New Application", status: "new", cards: [{ name: "Ella Ward", role: "Care Assistant" }] },
  { label: "Contacted", status: "contacted", cards: [{ name: "Noah Kim", role: "Support Worker" }] },
  { label: "Screening", status: "screening", cards: [{ name: "Ivy Brooks", role: "Care Assistant" }] },
  { label: "Interview Booked", status: "interview", cards: [] },
  { label: "Documents Required", status: "documents", cards: [{ name: "Omar Farid", role: "Nurse" }] },
  { label: "Ready to Hire", status: "ready", cards: [{ name: "Lucy Grant", role: "Care Assistant" }] },
  { label: "Hired", status: "hired", cards: [{ name: "Ryan Scott", role: "Support Worker" }] },
];

// Shorter labels for the narrow portrait columns, same underlying stages.
const columnsNarrow: PipelineColumn[] = columnsWide.map((c) => ({ ...c }));
columnsNarrow[0].label = "New";
columnsNarrow[3].label = "Interview";
columnsNarrow[4].label = "Documents";
columnsNarrow[5].label = "Ready";

export const Scene11Pipeline: React.FC = () => {
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const gap = portrait ? 6 : 16;
  const numColumns = columnsWide.length;
  const availableWidth = width - 2 * safeMargin(width);
  const columnWidth = portrait
    ? Math.floor((availableWidth - (numColumns - 1) * gap) / numColumns)
    : 216;

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <AnimatedText headline="See exactly where" support="every candidate stands." delayFrames={2} />
        <Pipeline
          columns={portrait ? columnsNarrow : columnsWide}
          columnWidth={columnWidth}
          gap={gap}
          narrow={portrait}
          delayFrames={14}
          movingCard={{
            name: "Sarah Johnson",
            role: "Care Assistant",
            fromColumn: 0,
            toColumn: 3,
            startFrame: 34,
            endFrame: 66,
          }}
        />
      </div>
    </SceneContainer>
  );
};
