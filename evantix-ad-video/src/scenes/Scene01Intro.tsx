import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneContainer } from "../components/SceneContainer";
import { Logo } from "../components/Logo";
import { brand, colors } from "../config/brand";
import { useFade, useFadeUp, smoothEase } from "../utils/animation";

const PARTICLE_COUNT = 14;

export const Scene01Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const logoWidth = Math.min(width * 0.42, 340);

  const particlesOpacity = interpolate(frame, [0, 10, 26, 34], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoOpacity = useFade(22, 16);
  const logoStyle = {
    opacity: logoOpacity,
    transform: `scale(${interpolate(frame, [22, 40], [0.9, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: smoothEase,
    })})`,
  };
  const taglineStyle = useFadeUp(48, 14);

  return (
    <SceneContainer background="white" grid>
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <div style={{ position: "absolute", inset: 0, opacity: particlesOpacity }}>
          {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <Particle key={i} index={i} total={PARTICLE_COUNT} frame={frame} />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <div style={logoStyle}>
            <Logo width={logoWidth} />
          </div>
          <div
            style={{
              ...taglineStyle,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              color: colors.muted,
            }}
          >
            {brand.tagline}
          </div>
        </div>
      </div>
    </SceneContainer>
  );
};

const Particle: React.FC<{ index: number; total: number; frame: number }> = ({
  index,
  total,
  frame,
}) => {
  const angle = (index / total) * Math.PI * 2;
  const startRadius = 420;
  const progress = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });
  const radius = startRadius * (1 - progress);
  const x = Math.cos(angle + index) * radius;
  const y = Math.sin(angle + index) * radius;
  const isCyan = index % 3 === 0;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 8,
        height: 8,
        borderRadius: 999,
        background: isCyan ? colors.cyan400 : colors.blue500,
        transform: `translate(${x}px, ${y}px)`,
        boxShadow: `0 0 12px ${isCyan ? colors.cyan400 : colors.blue500}`,
      }}
    />
  );
};
