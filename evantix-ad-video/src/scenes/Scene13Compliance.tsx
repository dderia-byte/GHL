import React from "react";
import { ShieldCheck, IdCard, FileText, GraduationCap, Car, FileWarning } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { CRMWindow } from "../components/CRMWindow";
import { Notification } from "../components/Notification";
import { colors } from "../config/brand";
import { useFadeUp } from "../utils/animation";

type DocStatus = "Verified" | "Missing" | "Expiring soon" | "Awaiting upload";

const statusStyle: Record<DocStatus, { bg: string; fg: string }> = {
  Verified: { bg: colors.successBg, fg: colors.success },
  Missing: { bg: colors.dangerBg, fg: colors.danger },
  "Expiring soon": { bg: colors.warningBg, fg: colors.warning },
  "Awaiting upload": { bg: colors.surfaceAlt, fg: colors.mutedLight },
};

const documents: { icon: LucideIcon; label: string; status: DocStatus }[] = [
  { icon: ShieldCheck, label: "Enhanced DBS", status: "Verified" },
  { icon: IdCard, label: "Right to Work", status: "Verified" },
  { icon: FileText, label: "References", status: "Missing" },
  { icon: GraduationCap, label: "Training Certificates", status: "Expiring soon" },
  { icon: IdCard, label: "ID Documents", status: "Verified" },
  { icon: Car, label: "Driving Licence", status: "Awaiting upload" },
];

export const Scene13Compliance: React.FC = () => {
  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText
          headline="Track documents and compliance"
          support="without chasing spreadsheets."
          delayFrames={2}
        />
        <CRMWindow title="Evantix — Compliance" width={760} height={440} padding={22} delayFrames={12}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {documents.map((doc, i) => (
              <DocRow key={doc.label} {...doc} delayFrames={16 + i * 7} />
            ))}
          </div>
        </CRMWindow>
      </div>
      <Notification
        title="Reminder sent"
        subtitle="References — awaiting upload"
        tone="warning"
        icon={FileWarning}
        delayFrames={70}
        style={{ bottom: 84, right: 90 }}
      />
    </SceneContainer>
  );
};

const DocRow: React.FC<{ icon: LucideIcon; label: string; status: DocStatus; delayFrames: number }> = ({
  icon: Icon,
  label,
  status,
  delayFrames,
}) => {
  const style = useFadeUp(delayFrames, 12);
  const s = statusStyle[status];
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: 12,
        background: colors.white,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: colors.surfaceAlt,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon size={14} color={colors.blue500} />
      </div>
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.navy900 }}>{label}</div>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: s.fg,
          background: s.bg,
          padding: "4px 11px",
          borderRadius: 999,
        }}
      >
        {status}
      </div>
    </div>
  );
};
