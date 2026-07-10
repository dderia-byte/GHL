import React from "react";
import { MapPin, Clock, FileCheck } from "lucide-react";
import { colors } from "../config/brand";
import { useFadeScale } from "../utils/animation";

export type CandidateStatus =
  | "new"
  | "contacted"
  | "screening"
  | "interview"
  | "documents"
  | "ready"
  | "hired";

const statusMeta: Record<CandidateStatus, { label: string; bg: string; fg: string }> = {
  new: { label: "New Application", bg: "#EEF2FF", fg: "#4338CA" },
  contacted: { label: "Contacted", bg: "#EEF4FF", fg: colors.blue600 },
  screening: { label: "Screening", bg: "#FFF6E5", fg: "#B45309" },
  interview: { label: "Interview Booked", bg: "#E9F9F6", fg: "#0F766E" },
  documents: { label: "Documents Required", bg: colors.warningBg, fg: "#B45309" },
  ready: { label: "Ready to Hire", bg: "#E9F9F6", fg: colors.success },
  hired: { label: "Hired", bg: colors.successBg, fg: colors.success },
};

interface CandidateCardProps {
  name: string;
  role: string;
  location?: string;
  availability?: string;
  score?: number;
  status?: CandidateStatus;
  delayFrames?: number;
  compact?: boolean;
  /** Hides the role line and shrinks the avatar for very narrow (e.g. portrait pipeline) columns. */
  narrow?: boolean;
  width?: number | string;
  highlight?: boolean;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const CandidateCard: React.FC<CandidateCardProps> = ({
  name,
  role,
  location,
  availability,
  score,
  status,
  delayFrames = 0,
  compact = false,
  narrow = false,
  width,
  highlight = false,
}) => {
  const style = useFadeScale(delayFrames, 0.94);
  const meta = status ? statusMeta[status] : null;

  return (
    <div
      style={{
        ...style,
        width,
        background: colors.white,
        border: `1px solid ${highlight ? colors.blue400 : colors.border}`,
        borderRadius: narrow ? 12 : 18,
        padding: narrow ? "10px 8px" : compact ? 14 : 20,
        boxShadow: highlight
          ? "0 18px 40px -16px rgba(46,107,255,0.35)"
          : "0 14px 30px -18px rgba(11,16,48,0.18)",
        display: "flex",
        flexDirection: narrow ? "column" : "row",
        alignItems: narrow ? "center" : "stretch",
        gap: narrow ? 6 : compact ? 8 : 12,
        textAlign: narrow ? "center" : "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: narrow ? 0 : 12, flexDirection: narrow ? "column" : "row" }}>
        <div
          style={{
            width: narrow ? 28 : compact ? 36 : 46,
            height: narrow ? 28 : compact ? 36 : 46,
            borderRadius: 999,
            background: colors.gradientPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.white,
            fontWeight: 700,
            fontSize: narrow ? 10.5 : compact ? 13 : 16,
            flex: "none",
          }}
        >
          {initials(name)}
        </div>
        <div style={{ minWidth: 0, marginTop: narrow ? 5 : 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: narrow ? 10.5 : compact ? 14 : 17,
              color: colors.navy900,
              whiteSpace: narrow ? "normal" : "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>
          {!narrow && (
            <div style={{ fontSize: compact ? 12 : 13, color: colors.muted, fontWeight: 500 }}>
              {role}
            </div>
          )}
        </div>
        {typeof score === "number" && (
          <div
            style={{
              marginLeft: "auto",
              fontSize: compact ? 12 : 13,
              fontWeight: 800,
              color: score >= 80 ? colors.success : colors.blue600,
              background: score >= 80 ? colors.successBg : colors.surfaceAlt,
              padding: "4px 10px",
              borderRadius: 999,
              flex: "none",
            }}
          >
            {score}%
          </div>
        )}
      </div>

      {!compact && (location || availability) && (
        <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: colors.mutedLight }}>
          {location && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={13} /> {location}
            </span>
          )}
          {availability && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={13} /> {availability}
            </span>
          )}
        </div>
      )}

      {meta && (
        <div
          style={{
            alignSelf: "flex-start",
            fontSize: 11.5,
            fontWeight: 700,
            color: meta.fg,
            background: meta.bg,
            padding: "4px 10px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {status === "hired" || status === "ready" ? <FileCheck size={12} /> : null}
          {meta.label}
        </div>
      )}
    </div>
  );
};

export { statusMeta };
