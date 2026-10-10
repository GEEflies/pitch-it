import type { Metadata } from "next";
import { CameraRecordScreen } from "@/components/pitch/camera-record-screen";
import { requireUser } from "@/lib/auth/session";
import { loadPitchSetup } from "@/lib/pitch/setup";

export const instant = false;

export const metadata: Metadata = { title: "Nahrávanie s kamerou" };

export default async function CameraRecordPage() {
  const user = await requireUser("/app/nahravka/kamera");
  const { setup } = await loadPitchSetup(user.id);
  return <CameraRecordScreen setup={setup} audioHref="/app/nahravka" feedbackHref="/app/nahravka/{id}" />;
}
