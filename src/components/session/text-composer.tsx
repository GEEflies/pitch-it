"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";

export function TextComposer({ onSend, pending, disabled }: { onSend: (text: string) => Promise<void>; pending: boolean; disabled: boolean }) {
  const [value, setValue] = useState("");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = value.trim();
    if (!text || pending || disabled) return;
    setValue("");
    await onSend(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="sr-only" htmlFor="founder-answer">
        Tvoja odpoveď
      </label>
      <textarea
        id="founder-answer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        maxLength={4000}
        disabled={disabled}
        placeholder="Napíš odpoveď investorovi. Enter odošle, Shift+Enter je nový riadok."
        className="min-h-24 w-full flex-1 rounded-[12px] border border-line-strong bg-ink-2 px-4 py-3 text-[15px] leading-relaxed text-paper outline-none placeholder:text-faint focus:border-signal-soft focus:shadow-[0_0_0_3px_rgba(61,91,255,0.25)]"
      />
      <button type="submit" disabled={pending || disabled || !value.trim()} className={buttonClasses({ className: "sm:mb-0.5" })}>
        {pending ? <Spinner /> : null}
        Odoslať
      </button>
    </form>
  );
}
