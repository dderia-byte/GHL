import React from "react";
import { colors } from "../config/brand";
import { useCountUp, useFadeScale } from "../utils/animation";

interface ScoreGaugeProps {
  value: number;
  startFrame?: number;
  endFrame?: number;
  delayFrames?: number;
  size?: number;
  label?: string;
}

/** A circular progress ring that sweeps from 0 to `value`, with the number counting up in sync. */
export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  value,
  startFrame = 10,
  endFrame = 55,
  delayFrames = 0,
  size = 140,
  label,
}) => {
  const style = useFadeScale(delayFrames, 0.9);
  const count = useCountUp(value, startFrame, endFrame);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - count / 100);

  return (
    <div style={{ ...style, width: size, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceAlt} strokeWidth={12} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gauge-gradient)"
            strokeWidth={12}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id="gauge-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors.blue500} />
              <stop offset="100%" stopColor={colors.cyan400} />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.24,
            fontWeight: 800,
            color: colors.navy900,
          }}
          className="tabular"
        >
          {count}%
        </div>
      </div>
      {label && <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.muted }}>{label}</div>}
    </div>
  );
};
