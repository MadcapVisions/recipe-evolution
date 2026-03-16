"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useAppShell } from "@/components/shell/AppShellContext";

export function ShellContextPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { setContextPanel, mobilePanelTarget } = useAppShell();

  useEffect(() => {
    setContextPanel({
      title,
      description,
    });

    return () => {
      setContextPanel(null);
    };
  }, [description, setContextPanel, title]);

  return (
    <>
      {mobilePanelTarget ? createPortal(children, mobilePanelTarget) : null}
    </>
  );
}
