"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
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
    "border border-transparent bg-[color:var(--primary)] text-[color:#fff8f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_28px_rgba(182,63,41,0.22)] hover:bg-[color:var(--primary-strong)]",
  secondary:
    "border border-[rgba(142,84,60,0.12)] bg-[rgba(255,249,243,0.96)] text-[color:var(--text)] shadow-[0_6px_16px_rgba(101,47,29,0.05)] hover:bg-white",
  danger: "border border-[rgba(138,64,46,0.12)] bg-[color:#9d5e4a] text-white shadow-[0_10px_20px_rgba(122,70,52,0.12)] hover:bg-[color:#8a5443]",
};

const joinClasses = (...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ");

export function Button(props: ButtonProps) {
  const router = useRouter();
  const variant = props.variant ?? "primary";
  const className = joinClasses(baseStyles, variantStyles[variant], props.className);

  if ("href" in props) {
    const { href, children, disabled } = props as LinkButtonProps;
    return (
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        className={joinClasses(className, disabled ? "pointer-events-none" : undefined)}
        onClick={() => {
          if (disabled) {
            return;
          }

          startTransition(() => {
            router.push(href);
            router.refresh();
          });
        }}
      >
        {children}
      </button>
    );
  }

  const { children, type = "button", className: _omitCn, variant: _omitVariant, ...buttonProps } = props as NativeButtonProps;
  return (
    <button type={type} className={className} {...buttonProps}>
      {children}
    </button>
  );
}
