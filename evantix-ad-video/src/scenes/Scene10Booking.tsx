import React from "react";
import { CalendarCheck, Bell } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { colors } from "../config/brand";
import { useFadeScale, useFadeUp } from "../utils/animation";

const slots = ["09:00", "10:30", "13:00", "14:30"];
const SELECTED_INDEX = 1;

export const Scene10Booking: React.FC = () => {
  return (
    <SceneContainer background="surface" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <AnimatedText headline="Let candidates book interviews" support="automatically." delayFrames={2} />
        <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
          <BookingWidget />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CalendarCard title="Candidate Calendar" delayFrames={44} />
            <CalendarCard title="Recruiter Calendar" delayFrames={52} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <ReminderChip label="Reminder — 24 hours before" delayFrames={64} />
          <ReminderChip label="Reminder — 1 hour before" delayFrames={72} />
        </div>
      </div>
    </SceneContainer>
  );
};

const BookingWidget: React.FC = () => {
  const style = useFadeScale(10, 0.94);
  return (
    <div
      style={{
        ...style,
        width: 260,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 20px 40px -22px rgba(11,16,48,0.3)",
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.navy900, marginBottom: 12 }}>
        Thursday, 14 March
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {slots.map((slot, i) => (
          <TimeSlot key={slot} time={slot} selected={i === SELECTED_INDEX} delayFrames={18 + i * 5} />
        ))}
      </div>
    </div>
  );
};

const TimeSlot: React.FC<{ time: string; selected: boolean; delayFrames: number }> = ({
  time,
  selected,
  delayFrames,
}) => {
  const style = useFadeUp(delayFrames, 8);
  const activeStyle = useFadeScale(38, 0.85);
  const isActive = selected;
  return (
    <div
      style={{
        ...style,
        textAlign: "center",
        padding: "9px 0",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        background: isActive ? colors.gradientPrimary : colors.surface,
        color: isActive ? colors.white : colors.muted,
        transform: isActive ? activeStyle.transform : style.transform,
        boxShadow: isActive ? "0 10px 22px -10px rgba(46,107,255,0.5)" : "none",
      }}
    >
      {time}
    </div>
  );
};

const CalendarCard: React.FC<{ title: string; delayFrames: number }> = ({ title, delayFrames }) => {
  const style = useFadeUp(delayFrames, 14);
  return (
    <div
      style={{
        ...style,
        width: 240,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 14px 30px -20px rgba(11,16,48,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: colors.successBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <CalendarCheck size={16} color={colors.success} />
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.navy900 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: colors.mutedLight, fontWeight: 600 }}>
          Interview — Thu 14 Mar, 10:30
        </div>
      </div>
    </div>
  );
};

const ReminderChip: React.FC<{ label: string; delayFrames: number }> = ({ label, delayFrames }) => {
  const style = useFadeUp(delayFrames, 10);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 700,
        color: colors.blue600,
        background: colors.surfaceAlt,
        padding: "6px 12px",
        borderRadius: 999,
      }}
    >
      <Bell size={13} /> {label}
    </div>
  );
};
