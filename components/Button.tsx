"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type LinkButtonProps = SharedProps & {
  href: string;
  disabled?: boolean;
};

type NativeButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

const baseStyles =
  "inline-flex w-auto min-h-11 select-none items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(188,92,47,0.35)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:-translate-y-px enabled:active:translate-y-0";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent text-[color:#fff8f1] shadow-[0_14px_30px_rgba(188,92,47,0.22)] bg-[linear-gradient(135deg,#bc5c2f_0%,#d7793f_100%)] hover:brightness-[1.03]",
  secondary:
    "border border-[rgba(79,54,33,0.12)] bg-[rgba(255,252,246,0.92)] text-[color:var(--text)] shadow-[0_10px_24px_rgba(76,50,24,0.06)] hover:bg-white",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const joinClasses = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const className = joinClasses(baseStyles, variantStyles[variant], props.className);

  if ("href" in props) {
    const { href, children, disabled } = props as LinkButtonProps;
    return (
      <Link
        href={disabled ? "#" : href}
        aria-disabled={disabled ? "true" : undefined}
        className={joinClasses(className, disabled ? "pointer-events-none" : undefined)}
      >
        {children}
      </Link>
    );
  }

  const { children, type = "button", ...buttonProps } = props;
  return (
    <button type={type} className={className} {...buttonProps}>
      {children}
    </button>
  );
}
