import React from "react";
import { TrendingUp, LucideIcon } from "lucide-react";
import { colors } from "../config/brand";
import { useCountUp, useFadeUp } from "../utils/animation";

interface MetricCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  icon?: LucideIcon;
  trend?: string;
  delayFrames?: number;
  startFrame?: number;
  endFrame?: number;
  width?: number | string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  suffix = "",
  prefix = "",
  icon: Icon = TrendingUp,
  trend,
  delayFrames = 0,
  startFrame = 10,
  endFrame = 55,
  width,
}) => {
  const style = useFadeUp(delayFrames, 18);
  const count = useCountUp(value, startFrame, endFrame);

  return (
    <div
      style={{
        ...style,
        width,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: "18px 20px",
        boxShadow: "0 14px 30px -20px rgba(11,16,48,0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: colors.surfaceAlt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={17} color={colors.blue500} />
        </div>
        {trend && (
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.success }}>{trend}</div>
        )}
      </div>
      <div className="tabular" style={{ fontSize: 30, fontWeight: 800, color: colors.navy900 }}>
        {prefix}
        {count.toLocaleString("en-GB")}
        {suffix}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.muted }}>{label}</div>
    </div>
  );
};
