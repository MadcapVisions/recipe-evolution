"use client";

import { createContext, useContext } from "react";

export type AppShellSide = "left" | "right";

export type AppShellSidePanel = {
  side: AppShellSide;
  label: string;
  title: string;
  description?: string;
};

export type AppShellNavLink = {
  href: string;
  label: string;
};

type AppShellContextValue = {
  leftPanel: AppShellSidePanel | null;
  rightPanel: AppShellSidePanel | null;
  setSidePanel: (side: AppShellSide, panel: Omit<AppShellSidePanel, "side"> | null) => void;
  openPanel: AppShellSide | null;
  setOpenPanel: (side: AppShellSide | null) => void;
  leftPanelTarget: HTMLDivElement | null;
  rightPanelTarget: HTMLDivElement | null;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);

  if (!context) {
    throw new Error("useAppShell must be used within an AppShellContext provider.");
  }

  return context;
}
