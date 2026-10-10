import type { Metadata } from "next";
import { FeedbackScreen } from "@/components/pitch/feedback-screen";
import { FEEDBACK_FIXTURE } from "@/lib/pitch/feedback";

export const metadata: Metadata = { title: "Feedback" };

export default function PreviewFeedback() {
  return <FeedbackScreen preview data={FEEDBACK_FIXTURE} />;
}
