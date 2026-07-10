import React from "react";
import {
  Mail,
  PhoneMissed,
  Sheet,
  CalendarClock,
  ShieldAlert,
  RefreshCcw,
  UserX,
  Laptop,
  LucideIcon,
} from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { Notification } from "../components/Notification";
import { colors } from "../config/brand";
import { useFadeScale } from "../utils/animation";

const items = [
  { icon: Mail, label: "34 unread emails", x: -300, y: -150, tone: "warning" as const },
  { icon: PhoneMissed, label: "6 missed calls", x: 290, y: -170, tone: "warning" as const },
  { icon: Sheet, label: "Candidate spreadsheet", x: -340, y: 60, tone: "default" as const },
  { icon: CalendarClock, label: "Interview reminders", x: 320, y: 40, tone: "default" as const },
  { icon: ShieldAlert, label: "Compliance documents", x: -220, y: 210, tone: "warning" as const },
  { icon: RefreshCcw, label: "Manual follow-ups", x: 240, y: 220, tone: "default" as const },
  { icon: UserX, label: "3 empty shifts", x: 0, y: 250, tone: "warning" as const },
];

export const Scene02Problem: React.FC = () => {
  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <AnimatedText
          eyebrow="Sound familiar?"
          headline="Too many systems."
          support="Too much manual work."
          delayFrames={2}
        />
        <div style={{ position: "relative", width: 760, height: 360 }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: colors.navy900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 30px 60px -20px rgba(11,16,48,0.4)",
            }}
          >
            <Laptop size={40} color={colors.white} />
          </div>
          {items.map((item, i) => (
            <FloatingTask key={item.label} {...item} delayFrames={14 + i * 6} />
          ))}
        </div>
      </div>
      <Notification
        title="New candidate applied"
        subtitle="via careers page"
        delayFrames={40}
        tone="default"
        style={{ top: 60, right: 90 }}
      />
      <Notification
        title="Reference overdue"
        subtitle="Awaiting response 4 days"
        delayFrames={58}
        tone="warning"
        style={{ bottom: 90, left: 90 }}
      />
    </SceneContainer>
  );
};

const FloatingTask: React.FC<{
  icon: LucideIcon;
  label: string;
  x: number;
  y: number;
  tone: "default" | "warning";
  delayFrames: number;
}> = ({ icon: Icon, label, x, y, tone, delayFrames }) => {
  const style = useFadeScale(delayFrames, 0.7);
  const toneColor = tone === "warning" ? colors.warning : colors.blue500;
  const toneBg = tone === "warning" ? colors.warningBg : colors.surfaceAlt;

  return (
    <div
      style={{
        ...style,
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `${style.transform} translate(-50%, -50%)`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: "9px 14px",
        boxShadow: "0 14px 28px -18px rgba(11,16,48,0.28)",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: toneBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon size={14} color={toneColor} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: colors.navy900 }}>{label}</span>
    </div>
  );
};
