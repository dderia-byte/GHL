import React from "react";
import { SceneContainer } from "../components/SceneContainer";
import { AnimatedText } from "../components/AnimatedText";
import { WorkflowBuilder, WorkflowNode } from "../components/WorkflowBuilder";

const nodes: WorkflowNode[] = [
  { label: "Application submitted" },
  { label: "Send confirmation" },
  { label: "Wait 10 minutes" },
  { label: "Send booking link" },
  { label: "No booking after 24 hours?", condition: true },
  { label: "Send follow-up SMS" },
  { label: "Notify recruiter" },
  { label: "Update pipeline stage" },
];

export const Scene12Workflow: React.FC = () => {
  return (
    <SceneContainer background="white" grid>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <AnimatedText headline="Follow-up continues" support="even when your team is busy." delayFrames={2} />
        <WorkflowBuilder nodes={nodes} delayFrames={12} nodeHeight={46} width={440} pulseStartFrame={26} pulseDurationFrames={62} />
      </div>
    </SceneContainer>
  );
};
