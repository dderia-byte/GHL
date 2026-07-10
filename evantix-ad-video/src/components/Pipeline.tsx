import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../config/brand";
import { CandidateCard, CandidateStatus } from "./CandidateCard";
import { useFadeUp, smoothEase } from "../utils/animation";

export interface PipelineColumn {
  label: string;
  status: CandidateStatus;
  cards: { name: string; role: string }[];
}

interface PipelineProps {
  columns: PipelineColumn[];
  columnWidth?: number;
  gap?: number;
  delayFrames?: number;
  /** Renders cards in a compact stacked (avatar-over-name, no role line) layout for narrow columns. */
  narrow?: boolean;
  /** Animates a ghost card sliding from one column index to another. */
  movingCard?: {
    name: string;
    role: string;
    fromColumn: number;
    toColumn: number;
    startFrame: number;
    endFrame: number;
  };
}

const CARD_HEIGHT = 96;

export const Pipeline: React.FC<PipelineProps> = ({
  columns,
  columnWidth = 220,
  gap = 16,
  delayFrames = 0,
  narrow = false,
  movingCard,
}) => {
  const frame = useCurrentFrame();
  const containerStyle = useFadeUp(delayFrames, 20);

  const colX = (i: number) => i * (columnWidth + gap);

  let ghostX = 0;
  let ghostY = 0;
  let ghostOpacity = 0;
  if (movingCard) {
    const progress = interpolate(
      frame,
      [movingCard.startFrame, movingCard.endFrame],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothEase }
    );
    ghostX = interpolate(progress, [0, 1], [colX(movingCard.fromColumn), colX(movingCard.toColumn)]);
    ghostY = 44 + interpolate(progress, [0, 0.5, 1], [0, -14, 0]);
    ghostOpacity = interpolate(
      frame,
      [movingCard.startFrame - 5, movingCard.startFrame, movingCard.endFrame, movingCard.endFrame + 5],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  return (
    <div style={{ ...containerStyle, position: "relative", display: "flex", gap }}>
      {columns.map((col, i) => (
        <div key={col.label} style={{ width: columnWidth, flex: "none" }}>
          <div
            style={{
              fontSize: narrow ? 10.5 : 12.5,
              fontWeight: 700,
              color: colors.muted,
              marginBottom: 8,
              lineHeight: 1.2,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            <span>{col.label}</span>
            <span
              style={{
                background: colors.surfaceAlt,
                color: colors.mutedLight,
                borderRadius: 999,
                padding: "1px 7px",
                fontSize: narrow ? 10 : 11,
                flex: "none",
              }}
            >
              {col.cards.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: narrow ? 6 : 10 }}>
            {col.cards.map((c) => (
              <CandidateCard key={c.name + col.label} name={c.name} role={c.role} compact narrow={narrow} />
            ))}
          </div>
        </div>
      ))}

      {movingCard && (
        <div
          style={{
            position: "absolute",
            top: ghostY,
            left: ghostX,
            width: columnWidth,
            opacity: ghostOpacity,
            filter: "drop-shadow(0 20px 30px rgba(46,107,255,0.35))",
            zIndex: 5,
          }}
        >
          <CandidateCard name={movingCard.name} role={movingCard.role} compact narrow={narrow} highlight />
        </div>
      )}
    </div>
  );
};

export const PIPELINE_CARD_HEIGHT = CARD_HEIGHT;
