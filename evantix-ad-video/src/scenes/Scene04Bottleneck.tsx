import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Mail, Sheet, MessageCircle, FileText, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { Cursor } from "../components/Cursor";
import { colors } from "../config/brand";
import { useFadeScale, smoothEase } from "../utils/animation";

const channels = [
  { label: "Email Inbox", icon: Mail, names: ["Sarah Johnson", "Tom Reid"], x: -230, y: -100 },
  { label: "Spreadsheet", icon: Sheet, names: ["Maya Osei", "Liam Chan"], x: 210, y: -100 },
  { label: "WhatsApp", icon: MessageCircle, names: ["Grace Lee"], x: -230, y: 110 },
  { label: "Paper Form", icon: FileText, names: ["Ben Ahmed"], x: 210, y: 110 },
];

export const Scene04Bottleneck: React.FC = () => {
  const frame = useCurrentFrame();
  const convergence = interpolate(frame, [58, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <AnimatedText
          headline="Recruitment shouldn't depend on"
          support="spreadsheets and memory."
          delayFrames={2}
        />
        <div style={{ position: "relative", width: 700, height: 320 }}>
          {channels.map((c, i) => (
            <ChannelPanel key={c.label} {...c} delayFrames={14 + i * 8} convergence={convergence} />
          ))}
          <Cursor
            from={[160, 100]}
            to={[520, 100]}
            moveStartFrame={34}
            moveEndFrame={52}
            clickFrame={52}
          />
        </div>
      </div>
    </SceneContainer>
  );
};

const ChannelPanel: React.FC<{
  label: string;
  icon: LucideIcon;
  names: string[];
  x: number;
  y: number;
  delayFrames: number;
  convergence: number;
}> = ({ label, icon: Icon, names, x, y, delayFrames, convergence }) => {
  const style = useFadeScale(delayFrames, 0.9);
  const cx = interpolate(convergence, [0, 1], [x, 0]);
  const cy = interpolate(convergence, [0, 1], [y, 0]);
  const opacity = interpolate(convergence, [0, 1], [1, 0]);
  const scale = interpolate(convergence, [0, 1], [1, 0.7]);

  return (
    <div
      style={{
        ...style,
        opacity: style.opacity * opacity,
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${cx}px, ${cy}px) scale(${scale})`,
        width: 210,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 14,
        boxShadow: "0 18px 34px -20px rgba(11,16,48,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: colors.surfaceAlt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} color={colors.blue500} />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.navy900 }}>{label}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {names.map((n) => (
          <div
            key={n}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.muted,
              background: colors.surface,
              borderRadius: 8,
              padding: "6px 9px",
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
};
