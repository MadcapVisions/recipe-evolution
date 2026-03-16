"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useAppShell, type AppShellSide } from "@/components/shell/AppShellContext";

export function ShellContextPanel({
  side,
  label,
  title,
  description,
  children,
}: {
  side: AppShellSide;
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { setSidePanel, leftPanelTarget, rightPanelTarget } = useAppShell();

  useEffect(() => {
    setSidePanel(side, {
      label,
      title,
      description,
    });

    return () => {
      setSidePanel(side, null);
    };
  }, [description, label, setSidePanel, side, title]);

  const target = side === "left" ? leftPanelTarget : rightPanelTarget;

  return target ? createPortal(children, target) : null;
}
