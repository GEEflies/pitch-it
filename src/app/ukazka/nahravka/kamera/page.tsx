import type { Metadata } from "next";
import { CameraRecordScreen } from "@/components/pitch/camera-record-screen";

export const metadata: Metadata = { title: "Nahrávanie s kamerou" };

export default function PreviewCameraRecord() {
  return (
    <CameraRecordScreen
      preview
      homeHref="/ukazka/prehlad"
      setupHref="/ukazka/vitaj"
      setup={{ audience: "investor", targetSeconds: 60, focus: "tempo" }}
      feedbackHref="/ukazka/nahravka/feedback"
    />
  );
}
