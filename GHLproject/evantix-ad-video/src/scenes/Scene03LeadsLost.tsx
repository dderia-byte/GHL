import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Globe, Linkedin, Facebook, Phone, Users, Clock, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { colors } from "../config/brand";
import { useFadeUp } from "../utils/animation";

const leads = [
  { name: "Amelia Turner", source: "Website", icon: Globe, badFrame: 40, label: "No response" },
  { name: "Josh Reynolds", source: "LinkedIn", icon: Linkedin, badFrame: 50, label: "Follow-up missed" },
  { name: "Priya Shah", source: "Facebook", icon: Facebook, badFrame: null, label: null },
  { name: "David Cole", source: "Phone", icon: Phone, badFrame: 58, label: "Contacted too late" },
  { name: "Nadia Ali", source: "Referral", icon: Users, badFrame: null, label: null },
];

export const Scene03LeadsLost: React.FC = () => {
  const frame = useCurrentFrame();
  const timer = interpolate(frame, [0, 75], [60, 312], { extrapolateRight: "clamp" });
  const minutes = Math.floor(timer / 60);
  const seconds = Math.floor(timer % 60);

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <AnimatedText
          headline="Opportunities are being lost"
          support="before anyone responds."
          delayFrames={2}
        />
        <CRMWindow title="Evantix — Enquiries" width={760} height={330} delayFrames={14}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy900 }}>New Enquiries</div>
            <div
              className="tabular"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: colors.danger,
                background: colors.dangerBg,
                padding: "5px 12px",
                borderRadius: 999,
              }}
            >
              <Clock size={14} /> Avg. response {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leads.map((lead, i) => (
              <LeadRow key={lead.name} {...lead} delayFrames={20 + i * 6} frame={frame} />
            ))}
          </div>
        </CRMWindow>
      </div>
    </SceneContainer>
  );
};

const LeadRow: React.FC<{
  name: string;
  source: string;
  icon: LucideIcon;
  badFrame: number | null;
  label: string | null;
  delayFrames: number;
  frame: number;
}> = ({ name, source, icon: Icon, badFrame, label, delayFrames, frame }) => {
  const enter = useFadeUp(delayFrames, 14);
  const isBad = badFrame !== null && frame >= badFrame;
  const fade = badFrame !== null ? interpolate(frame, [badFrame, badFrame + 12], [1, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;

  return (
    <div
      style={{
        ...enter,
        opacity: enter.opacity * fade,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: isBad ? colors.dangerBg : colors.surface,
        border: `1px solid ${isBad ? "#F8D2CE" : colors.border}`,
        transition: "none",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: colors.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
          border: `1px solid ${colors.border}`,
        }}
      >
        <Icon size={15} color={colors.blue500} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.navy900 }}>{name}</div>
        <div style={{ fontSize: 11.5, color: colors.mutedLight, fontWeight: 500 }}>via {source}</div>
      </div>
      {isBad && label && (
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.danger }}>{label}</div>
      )}
    </div>
  );
};
