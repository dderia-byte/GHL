import React from "react";
import { Building2, MapPin, UserCircle2, MessageCircle, Users, PoundSterling } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { colors, demoData } from "../config/brand";
import { useFadeUp, useCountUp } from "../utils/animation";

const details: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: MapPin, label: "Location", value: "Greater Manchester" },
  { icon: UserCircle2, label: "Account Owner", value: demoData.client.owner },
  { icon: MessageCircle, label: "Latest Communication", value: "Call — yesterday" },
];

export const Scene15Clients: React.FC = () => {
  const submitted = useCountUp(9, 30, 66);

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText headline="Manage candidates, clients" support="and opportunities together." delayFrames={2} />
        <CRMWindow title="Evantix — Client Workspace" width={780} height={360} delayFrames={12}>
          <ClientHeader />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {details.map((d, i) => (
              <DetailRow key={d.label} {...d} delayFrames={28 + i * 7} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <MiniStat icon={Users} label="Candidates Submitted" value={`${submitted}`} delayFrames={30} />
            <MiniStat icon={PoundSterling} label="Revenue Opportunity" value="£42,000" delayFrames={38} />
          </div>
        </CRMWindow>
      </div>
    </SceneContainer>
  );
};

const ClientHeader: React.FC = () => {
  const style = useFadeUp(14, 14);
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: colors.navy900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Building2 size={24} color={colors.white} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: colors.navy900 }}>{demoData.client.name}</div>
        <div style={{ fontSize: 12.5, color: colors.muted, fontWeight: 600 }}>
          {demoData.client.vacancies} open vacancies · Care Assistants, Support Workers
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: colors.danger,
          background: colors.dangerBg,
          padding: "5px 12px",
          borderRadius: 999,
        }}
      >
        {demoData.client.priority} Priority
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: LucideIcon; label: string; value: string; delayFrames: number }> = ({
  icon: Icon,
  label,
  value,
  delayFrames,
}) => {
  const style = useFadeUp(delayFrames, 10);
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 10 }}>
      <Icon size={14} color={colors.blue500} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.mutedLight, width: 170 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy900 }}>{value}</div>
    </div>
  );
};

const MiniStat: React.FC<{ icon: LucideIcon; label: string; value: string; delayFrames: number }> = ({
  icon: Icon,
  label,
  value,
  delayFrames,
}) => {
  const style = useFadeUp(delayFrames, 12);
  return (
    <div
      style={{
        ...style,
        flex: 1,
        background: colors.surface,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon size={16} color={colors.blue500} />
      <div>
        <div className="tabular" style={{ fontSize: 16, fontWeight: 800, color: colors.navy900 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.mutedLight }}>{label}</div>
      </div>
    </div>
  );
};
