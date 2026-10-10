import { redirect } from "next/navigation";

/** Kamera je hlavné nahrávanie na /app/nahravka; stará adresa ostáva funkčná. */
export default function CameraRecordRedirect() {
  redirect("/app/nahravka");
}
