import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Globe, FileEdit, Mail, MessageSquare, CalendarDays, Megaphone, ShieldCheck, Users2, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { Logo } from "../components/Logo";
import { colors } from "../config/brand";
import { useFadeScale, smoothEase } from "../utils/animation";

const nodes = [
  { label: "Website", icon: Globe, angle: -90 },
  { label: "Forms", icon: FileEdit, angle: -45 },
  { label: "Email", icon: Mail, angle: 0 },
  { label: "SMS", icon: MessageSquare, angle: 45 },
  { label: "Calendar", icon: CalendarDays, angle: 90 },
  { label: "Advertising", icon: Megaphone, angle: 135 },
  { label: "Compliance", icon: ShieldCheck, angle: 180 },
  { label: "Your Team", icon: Users2, angle: -135 },
];

const RADIUS = 240;

export const Scene05Connects: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <AnimatedText
          eyebrow="The Evantix platform"
          headline="One connected system."
          support="Built around your business."
          delayFrames={2}
        />
        <div style={{ position: "relative", width: RADIUS * 2 + 140, height: RADIUS * 2 + 40 }}>
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {nodes.map((n, i) => {
              const rad = (n.angle * Math.PI) / 180;
              const x = Math.cos(rad) * RADIUS;
              const y = Math.sin(rad) * RADIUS;
              const progress = interpolate(frame, [16 + i * 4, 40 + i * 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: smoothEase,
              });
              const cx = interpolate(progress, [0, 1], [x, 0]);
              const cy = interpolate(progress, [0, 1], [y, 0]);
              return (
                <line
                  key={n.label}
                  x1={`calc(50% + ${x}px)`}
                  y1={`calc(50% + ${y}px)`}
                  x2={`calc(50% + ${cx}px)`}
                  y2={`calc(50% + ${cy}px)`}
                  stroke={colors.blue400}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  opacity={0.55}
                />
              );
            })}
          </svg>

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 128,
              height: 128,
              borderRadius: 999,
              background: colors.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 30px 70px -20px rgba(46,107,255,0.4)",
              border: `1px solid ${colors.border}`,
            }}
          >
            <Logo width={64} />
          </div>

          {nodes.map((n, i) => {
            const rad = (n.angle * Math.PI) / 180;
            const x = Math.cos(rad) * RADIUS;
            const y = Math.sin(rad) * RADIUS;
            return (
              <IntegrationNode key={n.label} {...n} x={x} y={y} delayFrames={18 + i * 4} />
            );
          })}
        </div>
      </div>
    </SceneContainer>
  );
};

const IntegrationNode: React.FC<{
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
  delayFrames: number;
}> = ({ label, icon: Icon, x, y, delayFrames }) => {
  const style = useFadeScale(delayFrames, 0.5);
  return (
    <div
      style={{
        ...style,
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `${style.transform} translate(-50%, -50%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: colors.white,
          border: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 14px 28px -18px rgba(11,16,48,0.25)",
        }}
      >
        <Icon size={22} color={colors.blue500} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: colors.muted, whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
};
