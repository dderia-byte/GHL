import React from "react";
import { LucideIcon, Bell } from "lucide-react";
import { colors } from "../config/brand";
import { useFadeUp } from "../utils/animation";

interface NotificationProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning";
  delayFrames?: number;
  style?: React.CSSProperties;
}

const toneColor = {
  default: colors.blue500,
  success: colors.success,
  warning: colors.warning,
};

export const Notification: React.FC<NotificationProps> = ({
  title,
  subtitle,
  icon: Icon = Bell,
  tone = "default",
  delayFrames = 0,
  style,
}) => {
  const anim = useFadeUp(delayFrames, 14);

  return (
    <div
      style={{
        ...anim,
        ...style,
        position: "absolute",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: "12px 16px",
        boxShadow: "0 18px 34px -16px rgba(11,16,48,0.3)",
        minWidth: 220,
        maxWidth: 280,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: `${toneColor[tone]}1A`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon size={15} color={toneColor[tone]} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.navy900 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: colors.muted, fontWeight: 500, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
