import type { Metadata } from "next";
import { RecordScreen } from "@/components/pitch/record-screen";

export const metadata: Metadata = { title: "Nahrávanie" };

export default function PreviewRecord() {
  return (
    <RecordScreen
      preview
      setup={{ audience: "investor", targetSeconds: 60, focus: "tempo" }}
      cameraHref="/ukazka/nahravka/kamera"
      feedbackHref="/ukazka/nahravka/feedback"
    />
  );
}
