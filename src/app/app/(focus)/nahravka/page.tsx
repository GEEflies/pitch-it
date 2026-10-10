import type { Metadata } from "next";
import { CameraRecordScreen } from "@/components/pitch/camera-record-screen";
import { requireUser } from "@/lib/auth/session";
import { loadPitchSetup } from "@/lib/pitch/setup";

export const instant = false;

export const metadata: Metadata = { title: "Nahrávanie" };

export default async function RecordPage() {
  const user = await requireUser("/app/nahravka");
  const { setup } = await loadPitchSetup(user.id);
  return <CameraRecordScreen setup={setup} audioHref="/app/nahravka/zvuk" feedbackHref="/app/nahravka/{id}" />;
}
