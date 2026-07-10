import React from "react";
import { Briefcase, MapPin, Check } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../config/brand";
import { useFadeScale, useFadeUp } from "../utils/animation";

const candidates = [
  { name: "Sarah Johnson", match: true },
  { name: "Priya Shah", match: true },
  { name: "Tom Reid", match: false },
];

export const Scene16Matching: React.FC = () => {
  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText headline="Identify suitable candidates" support="faster." delayFrames={2} />
        <div style={{ display: "flex", gap: 34, alignItems: "flex-start" }}>
          <VacancyCard />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidates.map((c, i) => (
              <MatchRow key={c.name} {...c} delayFrames={24 + i * 10} />
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.mutedLight, ...useFadeUp(70, 10) }}>
          Your team remains in control of every final decision.
        </div>
      </div>
    </SceneContainer>
  );
};

const VacancyCard: React.FC = () => {
  const style = useFadeScale(10, 0.92);
  return (
    <div
      style={{
        ...style,
        width: 240,
        background: colors.navy900,
        borderRadius: 18,
        padding: 20,
        color: colors.white,
        boxShadow: "0 24px 50px -20px rgba(11,16,48,0.5)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Briefcase size={18} color={colors.white} />
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 6 }}>Care Assistant</div>
      <div style={{ fontSize: 12.5, opacity: 0.7, display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}>
        <MapPin size={12} /> Manchester · Full-time
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, opacity: 0.8 }}>
        <div>Distance ≤ 10 miles</div>
        <div>2+ years experience</div>
        <div>Full compliance verified</div>
      </div>
    </div>
  );
};

const MatchRow: React.FC<{ name: string; match: boolean; delayFrames: number }> = ({
  name,
  match,
  delayFrames,
}) => {
  const style = useFadeUp(delayFrames, 12);
  return (
    <div
      style={{
        ...style,
        width: 300,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 14,
        background: match ? colors.successBg : colors.surface,
        border: `1px solid ${match ? "#BCEFD6" : colors.border}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: colors.gradientPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.white,
          fontWeight: 800,
          fontSize: 12,
          flex: "none",
        }}
      >
        {name.split(" ").map((p) => p[0]).join("")}
      </div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.navy900 }}>{name}</div>
      {match ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11.5,
            fontWeight: 800,
            color: colors.success,
          }}
        >
          <Check size={14} /> Shortlisted
        </div>
      ) : (
        <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.mutedLight }}>Partial match</div>
      )}
    </div>
  );
};
