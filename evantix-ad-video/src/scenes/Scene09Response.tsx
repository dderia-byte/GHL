import React from "react";
import { MessageSquare, Mail, CheckCircle2, LucideIcon } from "lucide-react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText, Typewriter } from "../components/AnimatedText";
import { colors } from "../config/brand";
import { useFadeUp, useFadeScale } from "../utils/animation";

const checklist = [
  "SMS sent",
  "Email delivered",
  "Candidate notified",
  "Recruiter task completed",
];

export const Scene09Response: React.FC = () => {
  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <AnimatedText headline="Respond in seconds" support="not hours or days." delayFrames={2} />
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <MessageBubble
            icon={MessageSquare}
            title="SMS"
            text="Hi Sarah, thank you for applying. We'd like to invite you to the next stage."
            delayFrames={12}
          />
          <MessageBubble
            icon={Mail}
            title="Email"
            text="Your application has been received. Book your interview at a time that suits you."
            delayFrames={20}
          />
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {checklist.map((item, i) => (
            <ChecklistChip key={item} label={item} delayFrames={38 + i * 8} />
          ))}
        </div>
      </div>
    </SceneContainer>
  );
};

const MessageBubble: React.FC<{
  icon: LucideIcon;
  title: string;
  text: string;
  delayFrames: number;
}> = ({ icon: Icon, title, text, delayFrames }) => {
  const style = useFadeScale(delayFrames, 0.92);
  return (
    <div
      style={{
        ...style,
        width: 300,
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 20px 40px -22px rgba(11,16,48,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: colors.surfaceAlt,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} color={colors.blue500} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: colors.navy900 }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: colors.muted, fontWeight: 500, minHeight: 60 }}>
        <Typewriter text={text} startFrame={delayFrames + 6} charsPerFrame={1.6} />
      </div>
    </div>
  );
};

const ChecklistChip: React.FC<{ label: string; delayFrames: number }> = ({ label, delayFrames }) => {
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
        color: colors.success,
      }}
    >
      <CheckCircle2 size={15} /> {label}
    </div>
  );
};
