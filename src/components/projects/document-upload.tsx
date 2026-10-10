"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type DragEvent } from "react";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { checkUploadRequest, DOCUMENT_MIME } from "@/lib/documents/file-check";

type Phase = "idle" | "hashing" | "preparing" | "uploading" | "checking" | "error";

const PHASE_LABEL: Record<Exclude<Phase, "idle" | "error">, string> = {
  hashing: "Pripravujem súbor…",
  preparing: "Pripravujem nahrávanie…",
  uploading: "Nahrávam do súkromného úložiska…",
  checking: "Kontrolujem súbor a čítam slidy…",
};

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "Nahrávanie zlyhalo.";
  } catch {
    return "Nahrávanie zlyhalo.";
  }
}

/** Veľkosť časti pri nahrávaní (musí sedieť s UPLOAD_CHUNK_BYTES na serveri). */
const UPLOAD_CHUNK = 2 * 1024 * 1024;

export function DocumentUpload({
  projectId,
  disabledReason,
}: {
  projectId: string;
  disabledReason: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const busy = phase !== "idle" && phase !== "error";
  const disabled = Boolean(disabledReason) || busy;

  async function upload(file: File) {
    setError(null);
    const checked = checkUploadRequest({ fileName: file.name, size: file.size });
    if (!checked.ok) {
      setPhase("error");
      setError(checked.error);
      return;
    }

    try {
      setPhase("hashing");
      const sha256 = await sha256Hex(file);

      setPhase("preparing");
      const prepared = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size, sha256 }),
      });
      if (!prepared.ok) throw new Error(await readError(prepared));
      const { documentId, path, token } = (await prepared.json()) as { documentId: string; path: string; token: string };

      setPhase("uploading");
      const parts = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK));
      for (let part = 0; part < parts; part++) {
        const query = new URLSearchParams({ path, token, part: String(part), parts: String(parts) });
        const sent = await fetch(`/api/documents/upload?${query}`, {
          method: "PUT",
          headers: { "Content-Type": DOCUMENT_MIME[checked.kind] },
          body: file.slice(part * UPLOAD_CHUNK, (part + 1) * UPLOAD_CHUNK),
        }).catch(() => null);
        if (!sent?.ok) throw new Error("Súbor sa nepodarilo nahrať. Skontroluj pripojenie a skús to znova.");
      }

      setPhase("checking");
      const processed = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
      if (!processed.ok) throw new Error(await readError(processed));
      const result = (await processed.json()) as { slides: number };

      toast.show(`Podklad je nahraný (${result.slides} slidov). AI ho teraz analyzuje.`);
      setPhase("idle");
      router.refresh();
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof Error ? cause.message : "Nahrávanie zlyhalo.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-36 flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed px-6 py-8 text-center transition-colors ${
          disabled ? "cursor-not-allowed border-line opacity-70" : "cursor-pointer hover:border-signal-soft"
        } ${dragging ? "border-signal bg-signal/[0.06]" : "border-line-strong"}`}
      >
        {busy ? (
          <span className="flex items-center gap-2 text-paper" role="status">
            <Spinner />
            {PHASE_LABEL[phase as keyof typeof PHASE_LABEL]}
          </span>
        ) : (
          <>
            <span className="font-medium text-paper">Nahraj pitch deck</span>
            <span className="text-sm text-faint">PDF alebo PowerPoint (.pptx), najviac 25 MB. Pretiahni sem alebo klikni.</span>
          </>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      {disabledReason ? <p className="mt-3 text-sm text-faint">{disabledReason}</p> : null}
      {error ? (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      ) : null}
      <p className="mt-3 text-[13px] leading-relaxed text-faint">
        Súbor sa uloží do súkromného úložiska. Text a obsah slidov spracuje AI (Anthropic), aby navrhla fakty na kontrolu. Súbor môžeš kedykoľvek zmazať.
      </p>
    </div>
  );
}
