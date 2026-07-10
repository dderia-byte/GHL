import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { X, Check, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../config/brand";
import { isPortraitComposition, smoothEase, useFadeUp } from "../utils/animation";

const before = ["Scattered spreadsheets", "Missed follow-ups", "Slow response", "Manual admin", "Limited visibility"];
const after = ["Central CRM", "Automated communication", "Structured pipeline", "Faster response", "Clear reporting"];

export const Scene18Transformation: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const beforeShare = interpolate(frame, [30, 70], [50, 22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });

  return (
    <SceneContainer background="white">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%" }}>
        <AnimatedText headline="Less administration." support="More placements. More growth." delayFrames={2} />
        <div
          style={{
            display: "flex",
            flexDirection: portrait ? "column" : "row",
            width: portrait ? 640 : 900,
            height: portrait ? 480 : 320,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 30px 60px -24px rgba(11,16,48,0.3)",
          }}
        >
          <div
            style={{
              flexBasis: portrait ? undefined : `${beforeShare}%`,
              height: portrait ? `${beforeShare}%` : undefined,
              flexGrow: portrait ? undefined : 0,
              flexShrink: 0,
              background: "#EDEFF5",
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
            }}
          >
            <Label text="BEFORE" color={colors.mutedLight} />
            {before.map((item, i) => (
              <ListItem key={item} text={item} icon={X} tone="bad" delayFrames={16 + i * 5} />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              background: colors.gradientDark,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
            }}
          >
            <Label text="WITH EVANTIX" color={colors.cyan300} />
            {after.map((item, i) => (
              <ListItem key={item} text={item} icon={Check} tone="good" delayFrames={16 + i * 5} />
            ))}
          </div>
        </div>
      </div>
    </SceneContainer>
  );
};

const Label: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 2, color, marginBottom: 4 }}>{text}</div>
);

const ListItem: React.FC<{
  text: string;
  icon: LucideIcon;
  tone: "good" | "bad";
  delayFrames: number;
}> = ({ text, icon: Icon, tone, delayFrames }) => {
  const style = useFadeUp(delayFrames, 10);
  const isGood = tone === "good";
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 8 }}>
      <Icon size={14} color={isGood ? colors.cyan400 : "#9CA3AF"} />
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: isGood ? "rgba(255,255,255,0.9)" : "#6B7280",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
};
