import React from "react";
import { useVideoConfig } from "remotion";
import { FileText, Clock, CalendarCheck, UserCheck, Briefcase, TrendingUp, ListChecks, Timer } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { MetricCard } from "../components/MetricCard";
import { LineChart } from "../components/Chart";
import { colors, demoData } from "../config/brand";
import { isPortraitComposition, useFadeUp } from "../utils/animation";

export const Scene17Dashboard: React.FC = () => {
  const { width, height } = useVideoConfig();
  const portrait = isPortraitComposition(width, height);
  const m = demoData.metrics;

  const metrics = [
    { icon: FileText, label: "Applications Received", value: m.applications },
    { icon: Clock, label: "Avg. Response (mins)", value: m.responseTimeMinutes },
    { icon: CalendarCheck, label: "Interviews Booked", value: m.interviewsBooked },
    { icon: UserCheck, label: "Candidates Hired", value: m.hired },
    { icon: Briefcase, label: "Open Vacancies", value: m.openVacancies },
    { icon: TrendingUp, label: "Conversion Rate", value: m.conversionRate, suffix: "%" },
    { icon: ListChecks, label: "Tasks Completed", value: m.tasksCompleted },
    { icon: Timer, label: "Hours Saved / Month", value: m.hoursSaved },
  ];

  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <AnimatedText headline="Turn activity into clear," support="measurable performance." delayFrames={2} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: portrait ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 12,
            width: portrait ? 640 : 860,
          }}
        >
          {metrics.map((met, i) => (
            <MetricCard
              key={met.label}
              icon={met.icon}
              label={met.label}
              value={met.value}
              suffix={met.suffix}
              delayFrames={12 + i * 4}
              startFrame={20}
              endFrame={62}
            />
          ))}
        </div>
        {!portrait && (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <LineChart points={[12, 18, 15, 24, 30, 28, 36]} width={340} height={90} delayFrames={44} startFrame={44} endFrame={80} />
            <DemoLabel />
          </div>
        )}
        {portrait && <DemoLabel />}
      </div>
    </SceneContainer>
  );
};

const DemoLabel: React.FC = () => {
  const style = useFadeUp(60, 10);
  return (
    <div
      style={{
        ...style,
        fontSize: 12,
        fontWeight: 700,
        color: colors.mutedLight,
        background: colors.surfaceAlt,
        padding: "6px 14px",
        borderRadius: 999,
      }}
    >
      Illustrative demo data
    </div>
  );
};
