import { z } from "zod";
import type { LlmMessage } from "@/lib/ai/llm/types";
import { CONTROL_NOTES } from "@/lib/investor/control";
import type { TranscriptLine } from "@/lib/investor/instructions";

/*
  Textový investor: rovnaké inštrukcie ako hlasový, odpoveď cez LLM.
  Použije sa, keď realtime nie je dostupný alebo ho používateľ nechce.
*/

export const textInvestorSchema = z.object({
  reply: z.string().describe("Tvoja ďalšia replika ako investor: najviac 3 vety, jedna otázka."),
  end_meeting: z.boolean().describe("true iba vtedy, keď sa táto replika lúči a stretnutie končí."),
});

export type TextInvestorReply = z.infer<typeof textInvestorSchema>;

/** Prepis rozhovoru → správy pre LLM (investor = assistant, founder = user). */
export function transcriptToMessages(
  transcript: TranscriptLine[],
  options: { timeUp: boolean; timeAlmostUp: boolean },
): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "user", content: CONTROL_NOTES.kickoff }];
  for (const line of transcript) {
    const text = line.text.trim() || (line.speaker === "founder" ? "(founder neodpovedal)" : "(bez repliky)");
    const role = line.speaker === "investor" ? "assistant" : "user";
    const last = messages[messages.length - 1];
    if (last.role === role) last.content = `${last.content}\n\n${text}`;
    else messages.push({ role, content: text });
  }

  const note = options.timeUp ? CONTROL_NOTES.timeUp : options.timeAlmostUp ? CONTROL_NOTES.timeAlmostUp : null;
  const last = messages[messages.length - 1];
  if (last.role === "assistant") {
    // Investor hovoril naposledy (napr. po obnovení), founder ešte neodpovedal.
    messages.push({ role: "user", content: note ?? "(founder mlčí, pokračuj otázkou)" });
  } else if (note) {
    last.content = `${last.content}\n\n${note}`;
  }
  return messages;
}

export const TEXT_CHANNEL_SUFFIX = `
# Formát odpovede
Vráť JSON s poľami "reply" (tvoja replika ako investor, najviac 3 vety, jedna otázka) a "end_meeting".
"end_meeting" nastav na true iba v replike, ktorou sa lúčiš. Nástroje v tomto režime nevoláš.`;
