import type { Metadata } from "next";
import { RecordScreen } from "@/components/pitch/record-screen";
import { requireUser } from "@/lib/auth/session";
import { loadPitchSetup } from "@/lib/pitch/setup";

export const instant = false;

export const metadata: Metadata = { title: "Nahrávanie" };

export default async function RecordPage() {
  const user = await requireUser("/app/nahravka");
  const { setup } = await loadPitchSetup(user.id);
  return <RecordScreen setup={setup} cameraHref="/app/nahravka/kamera" drillsHref="/app/nahravka/cvicenia" feedbackHref="/app/nahravka/{id}" />;
}
