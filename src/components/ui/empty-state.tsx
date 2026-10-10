import type { ReactNode } from "react";

/** Prázdny stav: povie, čo tu bude a ako to vytvoriť. */
export function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] border border-dashed border-line-strong px-6 py-10 md:px-10 ${className}`}>
      <h2 className="type-heading text-[1.35rem]">{title}</h2>
      {children ? <div className="mt-2 max-w-[38rem] leading-relaxed text-mute">{children}</div> : null}
      {action ? <div className="mt-6 flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
