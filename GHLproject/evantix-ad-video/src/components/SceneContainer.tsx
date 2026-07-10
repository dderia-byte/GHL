import React from "react";
import { useVideoConfig } from "remotion";
import { colors } from "../config/brand";
import { isPortraitComposition, safeMargin } from "../utils/animation";

export type SceneBackground = "white" | "surface" | "dark" | "gradient-soft";

interface SceneContainerProps {
  children: React.ReactNode;
  background?: SceneBackground;
  grid?: boolean;
  className?: string;
}

const backgroundStyles: Record<SceneBackground, React.CSSProperties> = {
  white: { background: colors.white },
  surface: { background: colors.surface },
  dark: { background: colors.gradientDark },
  "gradient-soft": { background: colors.gradientSoft },
};

/**
 * Every scene renders inside this container so padding, safe margins and the
 * ambient background grid stay perfectly consistent across all 20 scenes and
 * both aspect ratios.
 */
export const SceneContainer: React.FC<SceneContainerProps> = ({
  children,
  background = "white",
  grid = false,
  className,
}) => {
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const margin = safeMargin(width);
  const isDark = background === "dark";

  return (
    <div
      className={className}
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        ...backgroundStyles[background],
      }}
    >
      {grid && <BackgroundGrid dark={isDark} />}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: `${margin}px ${margin}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
        data-portrait={portrait}
      >
        {children}
      </div>
    </div>
  );
};

const BackgroundGrid: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const stroke = dark ? "rgba(255,255,255,0.06)" : "rgba(15,21,48,0.05)";
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <defs>
        <pattern id="scene-grid" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M 64 0 L 0 0 0 64" fill="none" stroke={stroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#scene-grid)" />
    </svg>
  );
};
