"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { UserMenu } from "@/components/UserMenu";
import { AppShellContext, type AppShellNavLink, type AppShellSide, type AppShellSidePanel } from "@/components/shell/AppShellContext";

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [locked]);
}

function AppNav({
  links,
  pathname,
  onNavigate,
}: {
  links: AppShellNavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  return (
    <nav className="space-y-2" aria-label="Primary">
      {links.map((link) => {
        const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));

        return (
          <button
            key={link.href}
            type="button"
            onClick={() => {
              onNavigate?.();
              startTransition(() => {
                router.push(link.href);
                router.refresh();
              });
            }}
            className={joinClasses(
              "flex min-h-11 w-full items-center rounded-[20px] px-4 py-3 text-left text-sm font-semibold transition",
              active
                ? "bg-[rgba(74,106,96,0.14)] text-[color:var(--primary-strong)] shadow-[inset_3px_0_0_var(--primary)]"
                : "text-[color:var(--muted)] hover:bg-white/80 hover:text-[color:var(--text)]"
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </button>
        );
      })}
    </nav>
  );
}

function ShellSurface({
  kicker = "Page tools",
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-panel flex h-full flex-col overflow-hidden">
      <div className="border-b border-[rgba(57,75,70,0.08)] px-4 py-4 sm:px-5">
        <p className="app-kicker">{kicker}</p>
        <h2 className="mt-2 font-display text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[26px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
    </section>
  );
}

function EdgePeek({
  side,
  label,
  onClick,
  hinted,
}: {
  side: AppShellSide;
  label: string;
  onClick: () => void;
  hinted: boolean;
}) {
  const sideClasses =
    side === "left"
      ? "left-0 rounded-r-[18px] border-l-0 pl-2 pr-3"
      : "right-0 rounded-l-[18px] border-r-0 pl-3 pr-2";

  const toneClasses =
    side === "left"
      ? label === "Summary"
        ? "bg-[rgba(242,248,244,0.96)] text-[color:var(--primary-strong)]"
        : "bg-[rgba(255,252,246,0.94)] text-[color:var(--text)]"
      : label === "Prep"
        ? "bg-[rgba(242,248,244,0.96)] text-[color:var(--primary-strong)]"
        : label === "Cook" || label === "Flow"
          ? "bg-[rgba(243,247,252,0.96)] text-slate-800"
          : label === "Finish"
            ? "bg-[rgba(249,244,234,0.96)] text-[color:var(--text)]"
            : "bg-[rgba(255,252,246,0.94)] text-[color:var(--text)]";

  const hintedMotion = side === "left" ? "translate-x-1.5" : "-translate-x-1.5";

  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClasses(
        "fixed top-1/2 z-40 -translate-y-1/2 border border-[rgba(79,54,33,0.12)] py-3 text-xs font-semibold uppercase tracking-[0.18em] shadow-[0_10px_24px_rgba(61,51,36,0.08)] backdrop-blur-sm transition-[transform,background-color,box-shadow] duration-300 xl:hidden",
        sideClasses,
        toneClasses,
        hinted && `${hintedMotion} shadow-[0_16px_32px_rgba(61,51,36,0.14)]`
      )}
      style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      aria-label={`Open ${label}`}
    >
      {label}
    </button>
  );
}

export function AppShellClient({
  children,
  navLinks,
  userLabel,
  userEmail,
  showUserMenu,
}: {
  children: ReactNode;
  navLinks: AppShellNavLink[];
  userLabel: string;
  userEmail: string | null;
  showUserMenu: boolean;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<AppShellSide | null>(null);
  const [leftPanel, setLeftPanel] = useState<AppShellSidePanel | null>(null);
  const [rightPanel, setRightPanel] = useState<AppShellSidePanel | null>(null);
  const [leftPanelTarget, setLeftPanelTarget] = useState<HTMLDivElement | null>(null);
  const [rightPanelTarget, setRightPanelTarget] = useState<HTMLDivElement | null>(null);
  const [hintedSide, setHintedSide] = useState<AppShellSide | null>(null);

  useScrollLock(navOpen || openPanel !== null);

  const setSidePanel = useCallback((side: AppShellSide, panel: Omit<AppShellSidePanel, "side"> | null) => {
    if (side === "left") {
      setLeftPanel(panel ? { side, ...panel } : null);
      return;
    }

    setRightPanel(panel ? { side, ...panel } : null);
  }, []);

  const contextValue = useMemo(
    () => ({
      leftPanel,
      rightPanel,
      setSidePanel,
      openPanel,
      setOpenPanel,
      leftPanelTarget,
      rightPanelTarget,
    }),
    [leftPanel, rightPanel, setSidePanel, openPanel, leftPanelTarget, rightPanelTarget]
  );

  useEffect(() => {
    setNavOpen(false);
    setOpenPanel(null);
  }, [pathname]);

  useEffect(() => {
    if (openPanel === "left" && !leftPanel) {
      setOpenPanel(null);
    }
    if (openPanel === "right" && !rightPanel) {
      setOpenPanel(null);
    }
  }, [leftPanel, openPanel, rightPanel]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setNavOpen(false);
      setOpenPanel(null);
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1280 || openPanel !== null) {
      return;
    }

    const candidates: AppShellSide[] = [];
    if (leftPanel) {
      candidates.push("left");
    }
    if (rightPanel) {
      candidates.push("right");
    }
    if (candidates.length === 0) {
      return;
    }

    let timeoutA = 0;
    let timeoutB = 0;

    timeoutA = window.setTimeout(() => {
      setHintedSide(candidates[0] ?? null);
      timeoutB = window.setTimeout(() => {
        setHintedSide(candidates[1] ?? null);
        window.setTimeout(() => {
          setHintedSide(null);
        }, 240);
      }, candidates.length > 1 ? 620 : 240);
    }, 650);

    return () => {
      window.clearTimeout(timeoutA);
      window.clearTimeout(timeoutB);
      setHintedSide(null);
    };
  }, [leftPanel?.label, openPanel, pathname, rightPanel?.label]);

  return (
    <AppShellContext.Provider value={contextValue}>
      <div className="min-h-screen">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(79,54,33,0.08)] bg-[linear-gradient(180deg,rgba(248,243,234,0.96)_0%,rgba(245,239,229,0.92)_100%)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-3 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(79,54,33,0.12)] bg-[rgba(255,252,246,0.88)] text-[color:var(--text)] shadow-[0_6px_14px_rgba(76,50,24,0.05)] transition hover:bg-white xl:hidden"
              aria-label="Open navigation menu"
            >
              <span className="text-xl leading-none">☰</span>
            </button>

            <Link href="/" className="inline-flex shrink-0 items-center">
              <Image
                src="/assets/RE Logo png.png"
                alt="Recipe Evolution"
                width={460}
                height={88}
                priority
                className="h-[2.1rem] w-auto opacity-90 min-[380px]:h-[2.35rem] sm:h-[2.8rem] lg:h-[3.2rem]"
              />
            </Link>

            <div className="hidden min-[460px]:flex">
              <AiStatusBadge defaultMessage="Chef available" />
            </div>

            <nav className="ml-4 hidden xl:flex xl:flex-1 xl:items-center xl:justify-center xl:gap-2" aria-label="Primary">
              {navLinks.map((link) => {
                const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={joinClasses(
                      "rounded-full px-4 py-2 text-base font-semibold transition",
                      active
                        ? "bg-white/70 text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]"
                        : "text-[color:var(--muted)] hover:bg-white/60 hover:text-[color:var(--text)]"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {showUserMenu ? (
                <UserMenu label={userLabel} email={userEmail} />
              ) : (
                <Link href="/sign-in" className="ui-btn ui-btn-light min-h-11 px-4 text-sm">
                  Sign In
                </Link>
              )}
            </div>
          </div>
          <div className="border-t border-[rgba(79,54,33,0.06)] px-3 py-2 min-[460px]:hidden sm:px-6 xl:hidden">
            <AiStatusBadge defaultMessage="Chef available" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1440px] px-3 pb-6 pt-24 sm:px-6 sm:pt-26 lg:px-10 lg:pb-8 lg:pt-28">
          <main className="min-w-0 flex-1">
            <div className="app-shell animate-rise-in p-3 sm:p-6 lg:p-7">{children}</div>
          </main>
        </div>

        {leftPanel && openPanel !== "left" ? <EdgePeek side="left" label={leftPanel.label} hinted={hintedSide === "left"} onClick={() => setOpenPanel("left")} /> : null}
        {rightPanel && openPanel !== "right" ? <EdgePeek side="right" label={rightPanel.label} hinted={hintedSide === "right"} onClick={() => setOpenPanel("right")} /> : null}

        <div
          className={joinClasses(
            "fixed inset-0 z-[60] bg-[rgba(30,40,37,0.24)] backdrop-blur-[2px] transition xl:hidden",
            navOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setNavOpen(false)}
          aria-hidden={!navOpen}
        >
          <div
            className={joinClasses(
              "absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-[rgba(79,54,33,0.08)] bg-[linear-gradient(180deg,rgba(250,246,239,0.98)_0%,rgba(245,239,229,0.96)_100%)] p-4 shadow-[0_22px_48px_rgba(34,39,36,0.18)] transition-transform",
              navOpen ? "translate-x-0" : "-translate-x-full"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[24px] font-semibold text-[color:var(--text)]">Menu</p>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(79,54,33,0.12)] bg-white/80 text-lg text-[color:var(--text)]"
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>
            <div className="mt-4">
              <AppNav links={navLinks} pathname={pathname} onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        </div>

        <div
          className={joinClasses(
            "fixed inset-0 z-[60] bg-[rgba(30,40,37,0.24)] backdrop-blur-[2px] transition xl:hidden",
            openPanel !== null ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setOpenPanel(null)}
          aria-hidden={openPanel === null}
        >
          <div
            className={joinClasses(
              "absolute inset-y-0 left-0 w-[min(88vw,360px)] border-r border-[rgba(79,54,33,0.08)] bg-[linear-gradient(180deg,rgba(250,246,239,0.99)_0%,rgba(245,239,229,0.97)_100%)] p-3 shadow-[18px_0_42px_rgba(34,39,36,0.16)] transition-transform sm:p-4",
              openPanel === "left" ? "translate-x-0" : "-translate-x-full"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {leftPanel ? (
              <ShellSurface kicker="Page panel" title={leftPanel.title} description={leftPanel.description}>
                <div ref={setLeftPanelTarget} className="space-y-4" />
              </ShellSurface>
            ) : null}
          </div>

          <div
            className={joinClasses(
              "absolute inset-y-0 right-0 w-[min(92vw,380px)] border-l border-[rgba(79,54,33,0.08)] bg-[linear-gradient(180deg,rgba(250,246,239,0.99)_0%,rgba(245,239,229,0.97)_100%)] p-3 shadow-[-18px_0_42px_rgba(34,39,36,0.16)] transition-transform sm:p-4",
              openPanel === "right" ? "translate-x-0" : "translate-x-full"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {rightPanel ? (
              <ShellSurface kicker="Page tools" title={rightPanel.title} description={rightPanel.description}>
                <div ref={setRightPanelTarget} className="space-y-4" />
              </ShellSurface>
            ) : null}
          </div>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
