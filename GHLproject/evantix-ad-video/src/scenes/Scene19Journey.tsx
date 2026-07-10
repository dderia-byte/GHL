import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../config/brand";
import { isPortraitComposition, smoothEase, useFadeUp } from "../utils/animation";

const stages = ["Attract", "Capture", "Qualify", "Contact", "Book", "Verify", "Hire", "Grow"];

export const Scene19Journey: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const trackWidth = portrait ? 640 : 880;

  const pulseProgress = interpolate(frame, [14, 74], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });
  const pulseX = pulseProgress * trackWidth;

  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <AnimatedText
          headline="From first enquiry to"
          support="successful placement."
          delayFrames={2}
        />
        <div style={{ position: "relative", width: trackWidth, height: 90 }}>
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 0,
              right: 0,
              height: 3,
              borderRadius: 999,
              background: colors.border,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 0,
              width: pulseX,
              height: 3,
              borderRadius: 999,
              background: colors.gradientPrimary,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 12 - 6,
              left: pulseX - 6,
              width: 15,
              height: 15,
              borderRadius: 999,
              background: colors.cyan400,
              boxShadow: `0 0 0 6px rgba(63,223,209,0.25), 0 0 18px ${colors.cyan400}`,
              opacity: interpolate(frame, [10, 14, 76, 82], [0, 1, 1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
          {stages.map((s, i) => {
            const x = (i / (stages.length - 1)) * trackWidth;
            const litFrame = 14 + (i / (stages.length - 1)) * 60;
            return <StageNode key={s} label={s} x={x} litFrame={litFrame} frame={frame} />;
          })}
        </div>
        <Footer />
      </div>
    </SceneContainer>
  );
};

const StageNode: React.FC<{ label: string; x: number; litFrame: number; frame: number }> = ({
  label,
  x,
  litFrame,
  frame,
}) => {
  const lit = frame >= litFrame;
  const scale = interpolate(frame, [litFrame, litFrame + 6], [1, 1.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", top: 0, left: x, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: lit ? colors.blue500 : colors.border,
          transform: `scale(${lit ? scale : 1})`,
        }}
      />
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: lit ? colors.navy900 : colors.mutedLight,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const Footer: React.FC = () => {
  const style = useFadeUp(72, 12);
  return (
    <div style={{ ...style, fontSize: 15, fontWeight: 600, color: colors.muted, textAlign: "center" }}>
      Evantix helps your business move forward automatically.
    </div>
  );
};
