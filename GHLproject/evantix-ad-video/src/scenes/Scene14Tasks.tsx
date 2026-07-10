import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CheckCircle2 } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { colors } from "../config/brand";
import { useFadeUp, smoothEase } from "../utils/animation";

const tasks = [
  { label: "Call candidate", assignee: "JP", completeFrame: 40 },
  { label: "Review DBS", assignee: "SJ", completeFrame: null },
  { label: "Confirm reference", assignee: "MK", completeFrame: 52 },
  { label: "Prepare onboarding", assignee: "AL", completeFrame: null },
  { label: "Contact client", assignee: "JP", completeFrame: null },
  { label: "Fill urgent vacancy", assignee: "SJ", completeFrame: null },
];

export const Scene14Tasks: React.FC = () => {
  const frame = useCurrentFrame();
  const done = tasks.filter((t) => t.completeFrame !== null && frame >= t.completeFrame).length;
  const progress = interpolate(done, [0, tasks.length], [0, 100]);

  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText headline="The right task reaches" support="the right person." delayFrames={2} />
        <CRMWindow title="Evantix — Task Queue" width={700} height={340} delayFrames={12}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.navy900 }}>Today's Tasks</div>
            <div className="tabular" style={{ fontSize: 12.5, fontWeight: 700, color: colors.muted }}>
              {done} of {tasks.length} completed
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: colors.surfaceAlt, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: colors.gradientPrimary, transition: "none" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tasks.map((t, i) => (
              <TaskRow key={t.label} {...t} delayFrames={16 + i * 6} frame={frame} />
            ))}
          </div>
        </CRMWindow>
      </div>
    </SceneContainer>
  );
};

const TaskRow: React.FC<{
  label: string;
  assignee: string;
  completeFrame: number | null;
  delayFrames: number;
  frame: number;
}> = ({ label, assignee, completeFrame, delayFrames, frame }) => {
  const style = useFadeUp(delayFrames, 10);
  const isComplete = completeFrame !== null && frame >= completeFrame;
  const fadeOut = completeFrame
    ? interpolate(frame, [completeFrame, completeFrame + 14], [1, 0.3], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: smoothEase,
      })
    : 1;
  const slide = completeFrame
    ? interpolate(frame, [completeFrame, completeFrame + 14], [0, 20], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        ...style,
        opacity: style.opacity * fadeOut,
        transform: `${style.transform} translateX(${slide}px)`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        borderRadius: 10,
        background: colors.surface,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: colors.gradientPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.white,
          fontSize: 10.5,
          fontWeight: 800,
          flex: "none",
        }}
      >
        {assignee}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: 600,
          color: isComplete ? colors.mutedLight : colors.navy900,
          textDecoration: isComplete ? "line-through" : "none",
        }}
      >
        {label}
      </div>
      {isComplete && <CheckCircle2 size={16} color={colors.success} />}
    </div>
  );
};
