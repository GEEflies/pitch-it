import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/*
  Formulárové prvky. Chyba sa vždy viaže na pole cez aria-describedby
  a je vyjadrená textom aj farbou okraja.
*/

const control =
  "w-full rounded-[10px] border bg-ink-2 px-3.5 text-[15px] text-paper placeholder:text-faint " +
  "transition-[border-color,box-shadow] duration-150 outline-none " +
  "focus:border-signal-soft focus:shadow-[0_0_0_3px_rgba(59,130,246,0.25)] disabled:opacity-60";

function borderFor(error?: string | null) {
  return error ? "border-coral/70" : "border-line-strong";
}

type FieldShellProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ id, label, hint, error, optional, children, className = "" }: FieldShellProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-paper">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-faint">nepovinné</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[13px] leading-snug text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] leading-snug text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string | null, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: string | null; hint?: ReactNode };

export function Input({ error, hint, className = "", id, ...props }: InputProps) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={id ? describedBy(id, error, hint) : undefined}
      className={`${control} h-11 ${borderFor(error)} ${className}`}
      {...props}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string | null; hint?: ReactNode };

export function Textarea({ error, hint, className = "", id, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={id ? describedBy(id, error, hint) : undefined}
      className={`${control} py-2.5 leading-relaxed ${borderFor(error)} ${className}`}
      {...props}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { error?: string | null; hint?: ReactNode };

export function Select({ error, hint, className = "", id, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={id ? describedBy(id, error, hint) : undefined}
        className={`${control} h-11 appearance-none pr-10 ${borderFor(error)} ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-mute"
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  error?: string | null;
};

export function Checkbox({ label, error, id, className = "", ...props }: CheckboxProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-start gap-3 text-[14.5px] leading-snug text-paper/90">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className="mt-0.5 size-[18px] shrink-0 rounded-[5px] border-line-strong accent-signal"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 pl-[30px] text-[13px] text-coral" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
