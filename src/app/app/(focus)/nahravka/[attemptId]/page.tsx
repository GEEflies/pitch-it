import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackScreen } from "@/components/pitch/feedback-screen";
import { PI_BACKGROUND, PiTopbar } from "@/components/pitch/pi-topbar";
import { requireUser } from "@/lib/auth/session";
import { attemptNumber, getPitchAttempt, lastShare } from "@/lib/db/pitch";
import { buildFeedback } from "@/lib/pitch/feedback";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage({ params }: PageProps<"/app/nahravka/[attemptId]">) {
  const { attemptId } = await params;
  const user = await requireUser(`/app/nahravka/${attemptId}`);
  if (!isUuid(attemptId)) notFound();

  const attempt = await getPitchAttempt(attemptId);
  if (!attempt || attempt.user_id !== user.id) notFound();
  const retryHref = attempt.with_camera ? "/app/nahravka/kamera" : "/app/nahravka";

  if (attempt.status !== "ready") {
    return (
      <div style={{ background: PI_BACKGROUND, color: "var(--color-paper)", minHeight: "100dvh" }}>
        <PiTopbar />
        <main id="obsah" className="mx-auto max-w-xl px-6 py-24 text-center">
          <h1 className="font-display text-4xl font-bold">{attempt.status === "failed" ? "Analýza zlyhala." : "Ešte analyzujeme."}</h1>
          <p className="mt-4 text-mute">
            {attempt.status === "failed" ? "Nahrávku sa nepodarilo vyhodnotiť. Skús pitch nahrať znova." : "Obnov stránku o chvíľu."}
          </p>
          <Link href={retryHref} className="mt-8 inline-flex min-h-[46px] items-center rounded-full border border-line-strong px-6 font-bold">
            Skús znova
          </Link>
        </main>
      </div>
    );
  }

  const [number, previous] = await Promise.all([attemptNumber(attempt), lastShare(user.id)]);
  const data = buildFeedback(attempt, {
    number,
    retryHref,
    shareDefaults: { name: previous?.share_name ?? "", team: previous?.share_team ?? "", email: previous?.share_email ?? user.email ?? "" },
  });
  return <FeedbackScreen data={data} />;
}
