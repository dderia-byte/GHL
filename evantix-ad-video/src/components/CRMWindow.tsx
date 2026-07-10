import React from "react";
import { colors } from "../config/brand";
import { useFadeScale } from "../utils/animation";

interface CRMWindowProps {
  children: React.ReactNode;
  title?: string;
  width: number | string;
  height: number | string;
  delayFrames?: number;
  padding?: number;
}

/**
 * A polished "browser / app chrome" card that every dashboard-style scene
 * renders inside of, so the film always feels like one continuous product.
 */
export const CRMWindow: React.FC<CRMWindowProps> = ({
  children,
  title = "Evantix — Workspace",
  width,
  height,
  delayFrames = 0,
  padding = 28,
}) => {
  const style = useFadeScale(delayFrames, 0.96);

  return (
    <div
      style={{
        ...style,
        width,
        height,
        borderRadius: 24,
        background: colors.white,
        boxShadow: "0 40px 90px -30px rgba(11,16,48,0.28)",
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 22px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          flex: "none",
        }}
      >
        <Dot color="#F04438" />
        <Dot color="#F79009" />
        <Dot color="#12B76A" />
        <div
          style={{
            marginLeft: 12,
            fontSize: 14,
            fontWeight: 600,
            color: colors.muted,
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ flex: 1, padding, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
);
