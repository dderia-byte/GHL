import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { MapPin, Briefcase, Clock, FileCheck, Target, Activity } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { ScoreGauge } from "../components/ScoreGauge";
import { colors } from "../config/brand";
import { useFadeUp, smoothEase } from "../utils/animation";

const criteria = [
  { icon: MapPin, label: "Location Match", value: 96 },
  { icon: Briefcase, label: "Experience", value: 90 },
  { icon: Clock, label: "Availability", value: 88 },
  { icon: FileCheck, label: "Required Documents", value: 100 },
  { icon: Target, label: "Role Suitability", value: 92 },
  { icon: Activity, label: "Response Activity", value: 80 },
];

export const Scene08Scoring: React.FC = () => {
  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText
          headline="Prioritise the strongest"
          support="candidates automatically."
          delayFrames={2}
        />
        <CRMWindow title="Evantix — Candidate Scoring" width={800} height={360} delayFrames={12}>
          <div style={{ display: "flex", gap: 34, height: "100%" }}>
            <div
              style={{
                width: 200,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                borderRight: `1px solid ${colors.border}`,
                paddingRight: 24,
              }}
            >
              <ScoreGauge value={92} startFrame={14} endFrame={58} delayFrames={14} size={130} />
              <PriorityPill />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              {criteria.map((c, i) => (
                <CriterionRow key={c.label} {...c} delayFrames={18 + i * 6} />
              ))}
            </div>
          </div>
        </CRMWindow>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.mutedLight, opacity: useFadeUp(72, 10).opacity }}>
          Decision support — your recruitment team makes the final call.
        </div>
      </div>
    </SceneContainer>
  );
};

const PriorityPill: React.FC = () => {
  const style = useFadeUp(58, 12);
  return (
    <div
      style={{
        ...style,
        fontSize: 12.5,
        fontWeight: 800,
        color: colors.success,
        background: colors.successBg,
        padding: "6px 14px",
        borderRadius: 999,
      }}
    >
      High Priority
    </div>
  );
};

const CriterionRow: React.FC<{
  icon: LucideIcon;
  label: string;
  value: number;
  delayFrames: number;
}> = ({ icon: Icon, label, value, delayFrames }) => {
  const style = useFadeUp(delayFrames, 12);
  const frame = useCurrentFrame();
  const width = interpolate(frame, [delayFrames, delayFrames + 24], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });

  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 12 }}>
      <Icon size={15} color={colors.blue500} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.muted, width: 150 }}>{label}</div>
      <div style={{ flex: 1, height: 7, borderRadius: 999, background: colors.surfaceAlt, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: colors.gradientPrimary, borderRadius: 999 }} />
      </div>
      <div className="tabular" style={{ fontSize: 12, fontWeight: 700, color: colors.navy900, width: 30, textAlign: "right" }}>
        {Math.round(width)}%
      </div>
    </div>
  );
};
