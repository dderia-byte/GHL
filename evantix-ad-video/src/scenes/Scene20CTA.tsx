import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ArrowRight } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { Logo } from "../components/Logo";
import { Cursor } from "../components/Cursor";
import { brand, colors } from "../config/brand";
import { useFadeUp, useFadeScale } from "../utils/animation";

export const Scene20CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const logoStyle = useFadeUp(0, 16);
  const headlineStyle = useFadeUp(16, 16);
  const taglineStyle = useFadeUp(32, 14);
  const websiteStyle = useFadeUp(44, 12);
  const buttonStyle = useFadeScale(58, 0.85);

  const clickPulse = interpolate(frame, [92, 98, 108], [1, 0.93, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, position: "relative" }}>
        <div style={logoStyle}>
          <Logo width={220} />
        </div>
        <div
          style={{
            ...headlineStyle,
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: -1,
            color: colors.navy900,
            textAlign: "center",
            maxWidth: 700,
            marginTop: 8,
          }}
        >
          Ready to build a smarter recruitment system?
        </div>
        <div
          style={{
            ...taglineStyle,
            fontSize: 20,
            fontWeight: 700,
            color: colors.blue500,
            letterSpacing: 0.5,
          }}
        >
          {brand.tagline}
        </div>
        <div style={{ ...websiteStyle, fontSize: 15, fontWeight: 600, color: colors.muted }}>
          {brand.website}
        </div>

        <div style={{ position: "relative", width: 360, marginTop: 14, display: "flex", justifyContent: "center" }}>
          <div
            id="cta-button"
            style={{
              ...buttonStyle,
              transform: `${buttonStyle.transform} scale(${clickPulse})`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: colors.gradientPrimary,
              color: colors.white,
              fontSize: 17,
              fontWeight: 800,
              padding: "16px 32px",
              borderRadius: 999,
              boxShadow: "0 24px 50px -18px rgba(46,107,255,0.55)",
            }}
          >
            {brand.cta}
            <ArrowRight size={19} />
          </div>

          <Cursor from={[300, 80]} to={[182, 28]} moveStartFrame={78} moveEndFrame={94} clickFrame={94} />
        </div>
      </div>
    </SceneContainer>
  );
};
