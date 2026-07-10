import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../config/brand";
import { isPortraitComposition, useFadeUp } from "../utils/animation";

interface AnimatedTextProps {
  headline: string;
  support?: string;
  align?: "center" | "left";
  delayFrames?: number;
  light?: boolean;
  eyebrow?: string;
  maxWidth?: number;
}

/**
 * The single headline + one-line-support pattern used across every scene.
 * Headline rises in first, support line follows a few frames later.
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
  headline,
  support,
  align = "center",
  delayFrames = 0,
  light = false,
  eyebrow,
  maxWidth,
}) => {
  const { width } = useVideoConfig();
  const portrait = isPortraitComposition(width, useVideoConfig().height);
  const headlineStyle = useFadeUp(delayFrames, 22);
  const supportStyle = useFadeUp(delayFrames + 8, 16);
  const eyebrowStyle = useFadeUp(delayFrames, 12);

  const headlineSize = portrait ? 46 : 52;
  const supportSize = portrait ? 22 : 24;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        maxWidth: maxWidth ?? (portrait ? 780 : 980),
        gap: 14,
      }}
    >
      {eyebrow && (
        <div
          style={{
            ...eyebrowStyle,
            fontSize: portrait ? 15 : 16,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: colors.blue500,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          ...headlineStyle,
          margin: 0,
          fontSize: headlineSize,
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: -1,
          color: light ? colors.white : colors.navy900,
        }}
      >
        {headline}
      </h1>
      {support && (
        <p
          style={{
            ...supportStyle,
            margin: 0,
            fontSize: supportSize,
            lineHeight: 1.4,
            fontWeight: 500,
            color: light ? "rgba(255,255,255,0.78)" : colors.muted,
          }}
        >
          {support}
        </p>
      )}
    </div>
  );
};

interface TypewriterProps {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
}

/** Types text out character by character, with a blinking caret. */
export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame = 0,
  charsPerFrame = 0.9,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const count = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const done = count >= text.length;
  const showCaret = !done || Math.floor(frame / 15) % 2 === 0;

  return (
    <span style={style}>
      {text.slice(0, count)}
      <span style={{ opacity: showCaret ? 1 : 0 }}>|</span>
    </span>
  );
};
