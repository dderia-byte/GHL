import React from "react";
import { useVideoConfig } from "remotion";
import { CheckCircle2 } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText, Typewriter } from "../components/AnimatedText";
import { CandidateCard } from "../components/CandidateCard";
import { colors, demoData } from "../config/brand";
import { isPortraitComposition, useFadeScale, useFadeUp } from "../utils/animation";

const fields = [
  { label: "Full Name", value: "Sarah Johnson" },
  { label: "Role", value: "Senior Care Assistant" },
  { label: "Location", value: "Manchester, UK" },
  { label: "Experience", value: "4 years" },
  { label: "Right to Work", value: "Verified" },
];

export const Scene06Application: React.FC = () => {
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const phoneStyle = useFadeScale(4, 0.92);
  const cardStyle = useFadeUp(58, 20);

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <AnimatedText headline="Applications enter your CRM" support="automatically." delayFrames={2} />
        <div
          style={{
            display: "flex",
            flexDirection: portrait ? "column" : "row",
            alignItems: "center",
            gap: 44,
          }}
        >
          <div
            style={{
              ...phoneStyle,
              width: 240,
              borderRadius: 32,
              background: colors.navy900,
              padding: 10,
              boxShadow: "0 40px 80px -24px rgba(11,16,48,0.5)",
            }}
          >
            <div
              style={{
                background: colors.white,
                borderRadius: 24,
                padding: "22px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minHeight: 360,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.navy900, marginBottom: 4 }}>
                Apply Now
              </div>
              {fields.map((f, i) => (
                <div key={f.label}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: colors.mutedLight, marginBottom: 3 }}>
                    {f.label.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: colors.navy900,
                      background: colors.surface,
                      borderRadius: 8,
                      padding: "8px 10px",
                      minHeight: 14,
                    }}
                  >
                    {i === 0 ? <Typewriter text={f.value} startFrame={8} charsPerFrame={1.1} /> : f.value}
                  </div>
                </div>
              ))}
              <div
                id="submit-btn"
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: colors.white,
                  background: colors.gradientPrimary,
                  borderRadius: 10,
                  padding: "11px 0",
                }}
              >
                Submit Application
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
                color: colors.success,
              }}
            >
              <CheckCircle2 size={16} /> Synced to Evantix CRM
            </div>
            <CandidateCard
              name={demoData.candidate.name}
              role={demoData.candidate.role}
              location={demoData.candidate.location}
              availability={demoData.candidate.availability}
              status="new"
              width={260}
              delayFrames={58}
            />
          </div>
        </div>
      </div>
    </SceneContainer>
  );
};
