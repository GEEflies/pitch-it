import type { Metadata } from "next";
import { CameraRecordScreen } from "@/components/pitch/camera-record-screen";

export const metadata: Metadata = { title: "Nahrávanie s kamerou" };

export default function PreviewCameraRecord() {
  return (
    <CameraRecordScreen
      preview
      setup={{ audience: "investor", targetSeconds: 60, focus: "tempo" }}
      audioHref="/ukazka/nahravka"
      feedbackHref="/ukazka/nahravka/feedback"
    />
  );
}
