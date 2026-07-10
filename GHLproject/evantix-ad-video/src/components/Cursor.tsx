import React from "react";
import { MousePointer2 } from "lucide-react";
import { interpolate, useCurrentFrame } from "remotion";
import { smoothEase } from "../utils/animation";

interface CursorProps {
  from: [number, number];
  to: [number, number];
  moveStartFrame: number;
  moveEndFrame: number;
  /** Frame at which the click "pulse" fires, once the cursor has arrived. */
  clickFrame?: number;
}

/** A cursor that glides from one point to another and fires a click ripple on arrival. */
export const Cursor: React.FC<CursorProps> = ({
  from,
  to,
  moveStartFrame,
  moveEndFrame,
  clickFrame,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [moveStartFrame, moveEndFrame], [from[0], to[0]], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });
  const y = interpolate(frame, [moveStartFrame, moveEndFrame], [from[1], to[1]], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: smoothEase,
  });

  const click = clickFrame ?? moveEndFrame;
  const clickScale = interpolate(frame, [click, click + 5, click + 18], [1, 0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleScale = interpolate(frame, [click, click + 20], [0.3, 2.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(frame, [click, click + 4, click + 20], [0, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame, [moveStartFrame - 6, moveStartFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, zIndex: 50 }}>
      <div
        style={{
          position: "absolute",
          left: -10,
          top: -10,
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "#2E6BFF",
          opacity: rippleOpacity,
          transform: `scale(${rippleScale})`,
        }}
      />
      <div style={{ transform: `scale(${clickScale})`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" }}>
        <MousePointer2 size={26} fill="#0F1530" color="#0F1530" />
      </div>
    </div>
  );
};
