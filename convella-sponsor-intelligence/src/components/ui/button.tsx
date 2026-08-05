import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-soft hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-indigo-600",
  secondary:
    "bg-card text-foreground shadow-soft ring-1 ring-inset ring-border hover:bg-muted focus-visible:outline-border-strong",
  danger:
    "bg-card text-rose-600 shadow-soft ring-1 ring-inset ring-rose-200 hover:bg-rose-50 dark:ring-rose-900/40 dark:hover:bg-rose-950/40 focus-visible:outline-rose-500",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-border-strong",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </Link>
  );
}
