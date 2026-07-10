import React from "react";
import { Img, staticFile } from "remotion";
import { brand, colors } from "../config/brand";

interface LogoProps {
  width?: number;
  style?: React.CSSProperties;
  /** Renders the text-mark fallback instead of the image asset. */
  forceTextMark?: boolean;
}

/**
 * Renders the real Evantix logo asset. The logo is never redesigned or
 * recoloured — if `public/assets/evantix-logo.png` is replaced, this
 * component picks up the new file automatically.
 */
export const Logo: React.FC<LogoProps> = ({ width = 260, style, forceTextMark = false }) => {
  if (forceTextMark) {
    return <LogoTextMark width={width} style={style} />;
  }
  return (
    <Img
      src={staticFile(brand.logoPath)}
      style={{ width, height: "auto", display: "block", ...style }}
    />
  );
};

/** Text-based fallback mark, matching the real logo's wordmark + dot construction. */
export const LogoTextMark: React.FC<{ width?: number; style?: React.CSSProperties }> = ({
  width = 260,
  style,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "flex-end",
      fontWeight: 800,
      fontSize: width * 0.24,
      letterSpacing: -1,
      color: colors.navy900,
      lineHeight: 1,
      ...style,
    }}
  >
    {brand.shortName}
    <span
      style={{
        width: width * 0.045,
        height: width * 0.045,
        borderRadius: 999,
        background: colors.pink,
        marginLeft: 2,
        marginBottom: width * 0.02,
      }}
    />
  </div>
);
