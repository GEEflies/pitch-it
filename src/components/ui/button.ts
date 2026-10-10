type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out " +
  "active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-signal text-white hover:bg-signal-hover " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_30px_-12px_rgba(61,91,255,0.75)] " +
    "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_14px_36px_-12px_rgba(61,91,255,0.9)]",
  secondary:
    "border border-line-strong text-paper hover:border-signal-soft/70 hover:bg-panel",
  ghost: "text-mute hover:text-paper hover:bg-panel",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-[15px]",
  lg: "h-13 px-6 text-base",
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
