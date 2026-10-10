type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,transform,box-shadow,filter] duration-150 ease-out hover:-translate-y-0.5 " +
  "active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-signal bg-[linear-gradient(135deg,var(--color-signal-soft),var(--color-signal)_55%,var(--color-signal-deep))] text-on-signal hover:brightness-[1.08]",
  secondary: "border border-line-strong bg-transparent text-paper hover:border-mute",
  ghost: "text-mute hover:text-paper hover:bg-panel",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-[46px] px-[22px] text-[15px]",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}
