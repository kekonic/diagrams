import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label?: ReactNode;
  /** Icon-only (label becomes accessible name via title/aria-label). */
  iconOnly?: boolean;
  active?: boolean;
};

export function IconButton({
  icon: Icon,
  label,
  iconOnly,
  active,
  className,
  title,
  "aria-label": ariaLabel,
  ...rest
}: Props) {
  const classes = [
    "icon-btn",
    iconOnly ? "icon-btn-only" : null,
    active ? "active" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type="button"
      className={classes}
      title={title ?? (typeof label === "string" ? label : undefined)}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      aria-pressed={active}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      {!iconOnly && label != null ? <span>{label}</span> : null}
    </button>
  );
}
