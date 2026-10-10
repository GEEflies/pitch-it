import type { Metadata } from "next";
import { RecordScreen } from "@/components/pitch/record-screen";

export const metadata: Metadata = { title: "Nahrávanie" };

export default function PreviewRecord() {
  return (
    <RecordScreen
      preview
      homeHref="/ukazka/prehlad"
      setupHref="/ukazka/vitaj"
      setup={{ audience: "investor", targetSeconds: 60, focus: "tempo" }}
      cameraHref="/ukazka/nahravka/kamera"
      drillsHref="/ukazka/nahravka/cvicenia"
      feedbackHref="/ukazka/nahravka/feedback"
    />
  );
}
