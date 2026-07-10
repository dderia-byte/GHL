import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../config/brand";
import { smoothEase, useFadeUp } from "../utils/animation";

interface BarChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  startFrame?: number;
  endFrame?: number;
  delayFrames?: number;
}

/** A bar chart whose bars grow up from the baseline as if drawing themselves. */
export const BarChart: React.FC<BarChartProps> = ({
  data,
  width = 420,
  height = 180,
  startFrame = 10,
  endFrame = 55,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const containerStyle = useFadeUp(delayFrames, 14);
  const max = Math.max(...data.map((d) => d.value));
  const barWidth = width / data.length - 14;

  return (
    <div style={{ ...containerStyle, width, height: height + 26 }}>
      <svg width={width} height={height}>
        {data.map((d, i) => {
          const h = interpolate(frame, [startFrame + i * 4, endFrame], [0, (d.value / max) * height], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: smoothEase,
          });
          const x = i * (barWidth + 14);
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={height - h}
                width={barWidth}
                height={h}
                rx={7}
                fill="url(#bar-gradient)"
              />
            </g>
          );
        })}
        <defs>
          <linearGradient id="bar-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={colors.blue500} />
            <stop offset="100%" stopColor={colors.cyan400} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ display: "flex", marginTop: 8 }}>
        {data.map((d) => (
          <div
            key={d.label}
            style={{ width: barWidth + 14, textAlign: "center", fontSize: 11.5, color: colors.mutedLight, fontWeight: 600 }}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
};

interface LineChartProps {
  points: number[];
  width?: number;
  height?: number;
  startFrame?: number;
  endFrame?: number;
  delayFrames?: number;
}

/** A line chart that progressively draws its path with an animated dashoffset. */
export const LineChart: React.FC<LineChartProps> = ({
  points,
  width = 420,
  height = 140,
  startFrame = 10,
  endFrame = 60,
  delayFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const containerStyle = useFadeUp(delayFrames, 14);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / (max - min || 1)) * height;
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });
  const length = 2000;

  return (
    <div style={{ ...containerStyle, width, height }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="line-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.blue500} stopOpacity={0.22} />
            <stop offset="100%" stopColor={colors.blue500} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#line-area)" opacity={progress} />
        <path
          d={path}
          fill="none"
          stroke={colors.blue500}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - progress)}
        />
        {coords.map(([x, y], i) => {
          const dotOpacity = interpolate(
            frame,
            [startFrame + (i / coords.length) * (endFrame - startFrame), endFrame],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return <circle key={i} cx={x} cy={y} r={4} fill={colors.cyan400} opacity={dotOpacity} />;
        })}
      </svg>
    </div>
  );
};
