import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Zap } from "lucide-react";
import { colors } from "../config/brand";
import { useFadeScale, smoothEase } from "../utils/animation";

export interface WorkflowNode {
  label: string;
  icon?: React.ReactNode;
  condition?: boolean;
}

interface WorkflowBuilderProps {
  nodes: WorkflowNode[];
  delayFrames?: number;
  nodeHeight?: number;
  width?: number;
  /** Frame the pulse starts traveling from the first to the last node. */
  pulseStartFrame?: number;
  pulseDurationFrames?: number;
}

/**
 * A vertical automation graph: connected nodes with a light pulse that
 * travels down the line to visualise data flowing through each step.
 */
export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({
  nodes,
  delayFrames = 0,
  nodeHeight = 58,
  width = 420,
  pulseStartFrame = 20,
  pulseDurationFrames = 70,
}) => {
  const frame = useCurrentFrame();
  const gap = 22;
  const rowHeight = nodeHeight + gap;
  const totalHeight = nodes.length * nodeHeight + (nodes.length - 1) * gap;

  const pulseProgress = interpolate(
    frame,
    [pulseStartFrame, pulseStartFrame + pulseDurationFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smoothEase }
  );
  const pulseY = interpolate(pulseProgress, [0, 1], [nodeHeight / 2, totalHeight - nodeHeight / 2]);
  const pulseVisible = frame >= pulseStartFrame && frame <= pulseStartFrame + pulseDurationFrames + 6;

  return (
    <div style={{ position: "relative", width, height: totalHeight }}>
      {/* base connecting line */}
      <div
        style={{
          position: "absolute",
          left: 21,
          top: nodeHeight / 2,
          width: 2,
          height: totalHeight - nodeHeight,
          background: colors.border,
        }}
      />
      {/* lit portion of the line, growing with the node reveal */}
      {nodes.map((_, i) => {
        if (i === nodes.length - 1) return null;
        const litStyle = useFadeScale(delayFrames + i * 8 + 6, 1);
        return (
          <div
            key={`line-${i}`}
            style={{
              opacity: litStyle.opacity,
              position: "absolute",
              left: 21,
              top: i * rowHeight + nodeHeight / 2,
              width: 2,
              height: rowHeight,
              background: colors.gradientPrimary,
            }}
          />
        );
      })}

      {pulseVisible && (
        <div
          style={{
            position: "absolute",
            left: 21 - 6,
            top: pulseY - 6,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: colors.cyan400,
            boxShadow: `0 0 0 6px rgba(63,223,209,0.25), 0 0 16px ${colors.cyan400}`,
          }}
        />
      )}

      {nodes.map((node, i) => {
        const style = useFadeScale(delayFrames + i * 8, 0.9);
        return (
          <div
            key={node.label}
            style={{
              ...style,
              position: "absolute",
              top: i * rowHeight,
              left: 0,
              width,
              height: nodeHeight,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: node.condition ? colors.warningBg : colors.surfaceAlt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                border: `1px solid ${colors.border}`,
              }}
            >
              {node.icon ?? <Zap size={18} color={node.condition ? colors.warning : colors.blue500} />}
            </div>
            <div
              style={{
                flex: 1,
                background: colors.white,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 600,
                color: colors.navy900,
                boxShadow: "0 8px 20px -14px rgba(11,16,48,0.3)",
              }}
            >
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
