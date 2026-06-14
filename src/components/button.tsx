import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const base =
  "flex h-12 items-center justify-center gap-2 rounded-full px-5 font-medium transition-colors";

const variants: Record<Variant, string> = {
  primary:
    "bg-foreground text-background hover:bg-[#383838] dark:hover:bg-[#ccc]",
  secondary:
    "border border-solid border-black/[.08] hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]",
};

function classes(variant: Variant, className?: string): string {
  return [base, variants[variant], className].filter(Boolean).join(" ");
}

type ButtonProps = {
  variant?: Variant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary action button. Use {@link ButtonLink} when it should be an anchor. */
export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return <button className={classes(variant, className)} {...props} />;
}

type ButtonLinkProps = {
  variant?: Variant;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

/** Anchor styled as a {@link Button} (for navigation / external links). */
export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ButtonLinkProps) {
  return <a className={classes(variant, className)} {...props} />;
}
