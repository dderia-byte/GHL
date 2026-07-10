import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

/** Smooth, low-bounce spring preset used for every entrance in the film. */
export const enterSpring = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.9 },
  });

/** Fade + rise entrance. Returns style props to spread onto an element. */
export const useFadeUp = (delayFrames = 0, distance = 24) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterSpring(frame, fps, delayFrames);
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const translateY = interpolate(p, [0, 1], [distance, 0]);
  return { opacity, transform: `translateY(${translateY}px)` };
};

/** Fade + scale entrance (good for cards / panels appearing). */
export const useFadeScale = (delayFrames = 0, fromScale = 0.92) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enterSpring(frame, fps, delayFrames);
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const scale = interpolate(p, [0, 1], [fromScale, 1]);
  return { opacity, transform: `scale(${scale})` };
};

/** Simple eased opacity fade, no movement. */
export const useFade = (delayFrames = 0, durationFrames = 15) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [delayFrames, delayFrames + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
};

/** Counts a number up between two frames with a smooth cubic ease-out. */
export const useCountUp = (
  to: number,
  startFrame: number,
  endFrame: number,
  from = 0
) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [startFrame, endFrame], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return Math.round(value);
};

/** Draws an SVG stroke progressively using stroke-dasharray/offset. */
export const useDraw = (startFrame: number, endFrame: number, length = 1000) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - progress),
  };
};

export const isPortraitComposition = (width: number, height: number) => height > width;

/** Safe-margin padding (px) so text never sits near the crop edge on either aspect ratio. */
export const safeMargin = (width: number) => Math.round(width * 0.07);

/** Standard cubic-bezier easing used for non-spring, non-bounce motion throughout. */
export const smoothEase = Easing.bezier(0.22, 0.61, 0.36, 1);
