import React from "react";
import { FileCheck2, MapPin, Clock, UserCheck, History, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { ScoreGauge } from "../components/ScoreGauge";
import { colors, demoData } from "../config/brand";
import { useFadeUp } from "../utils/animation";

const detailRows = [
  { icon: MapPin, label: "Location", value: demoData.candidate.location },
  { icon: Clock, label: "Availability", value: demoData.candidate.availability },
  { icon: FileCheck2, label: "Documents", value: "4 of 4 verified" },
  { icon: UserCheck, label: "Assigned Recruiter", value: "James Patel" },
  { icon: History, label: "Last Contact", value: "2 minutes ago" },
];

export const Scene07Profile: React.FC = () => {
  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <AnimatedText headline="Every candidate. Every detail." support="In one place." delayFrames={2} />
        <CRMWindow title="Evantix — Candidate Profile" width={800} height={380} delayFrames={12}>
          <div style={{ display: "flex", gap: 30, height: "100%" }}>
            <div
              style={{
                width: 220,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                paddingRight: 24,
                borderRight: `1px solid ${colors.border}`,
              }}
            >
              <ProfileHeader />
              <ScoreGauge value={demoData.candidate.score} startFrame={16} endFrame={50} delayFrames={18} size={110} label="Match Score" />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              {detailRows.map((row, i) => (
                <DetailRow key={row.label} {...row} delayFrames={22 + i * 6} />
              ))}
            </div>
          </div>
        </CRMWindow>
      </div>
    </SceneContainer>
  );
};

const ProfileHeader: React.FC = () => {
  const style = useFadeUp(6, 14);
  return (
    <div style={{ ...style, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          background: colors.gradientPrimary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.white,
          fontWeight: 800,
          fontSize: 24,
        }}
      >
        SJ
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: colors.navy900, textAlign: "center" }}>
        {demoData.candidate.name}
      </div>
      <div style={{ fontSize: 13, color: colors.muted, fontWeight: 600, textAlign: "center" }}>
        {demoData.candidate.role}
      </div>
    </div>
  );
};

const DetailRow: React.FC<{
  icon: LucideIcon;
  label: string;
  value: string;
  delayFrames: number;
}> = ({ icon: Icon, label, value, delayFrames }) => {
  const style = useFadeUp(delayFrames, 12);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        background: colors.surface,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: colors.white,
          border: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon size={14} color={colors.blue500} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.mutedLight, width: 150 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.navy900 }}>{value}</div>
    </div>
  );
};
