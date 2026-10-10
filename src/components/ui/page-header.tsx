import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="mb-8 md:mb-10">
      {back ? <div className="mb-4">{back}</div> : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="type-display text-[clamp(2rem,1.5rem+1.6vw,2.75rem)]">{title}</h1>
          {description ? <div className="mt-3 max-w-[42rem] leading-relaxed text-mute">{description}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
