import type { Metadata } from "next";
import { RecordScreen } from "@/components/pitch/record-screen";
import { requireUser } from "@/lib/auth/session";
import { loadPitchSetup } from "@/lib/pitch/setup";

export const instant = false;

export const metadata: Metadata = { title: "Nahrávanie" };

// Dočasne: kým nie je hotová obrazovka s kamerou (Workspace), nahráva sa iba zvuk.
export default async function CameraRecordPage() {
  const user = await requireUser("/app/nahravka/kamera");
  const { setup } = await loadPitchSetup(user.id);
  return <RecordScreen setup={setup} cameraHref="/app/nahravka/kamera" feedbackHref="/app/nahravka/{id}" />;
}
