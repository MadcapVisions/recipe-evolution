"use client";

import { createContext, useContext } from "react";

export type AppShellContextPanel = {
  title: string;
  description?: string;
};

export type AppShellNavLink = {
  href: string;
  label: string;
};

type AppShellContextValue = {
  contextPanel: AppShellContextPanel | null;
  setContextPanel: (panel: AppShellContextPanel | null) => void;
  toolsOpen: boolean;
  setToolsOpen: (open: boolean) => void;
  mobilePanelTarget: HTMLDivElement | null;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error("useAppShell must be used within an AppShellContext provider.");
  }

  return context;
}
