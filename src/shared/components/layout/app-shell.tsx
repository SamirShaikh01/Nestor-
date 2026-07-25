"use client";

import { motion } from "framer-motion";
import { BarChart3, CalendarRange, LayoutGrid, Settings2, Workflow, Ticket, ShieldCheck, KeyRound, Users, LogOut } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { supabase, isSupabaseConfigured } from "@/src/shared/lib/supabase";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "tickets", label: "Ticket Log", icon: Ticket },
  { id: "oem-cases", label: "OEM Case Log", icon: ShieldCheck },
  { id: "shift-roster", label: "Shift Roster", icon: CalendarRange },
  { id: "password-vault", label: "Password Vault", icon: KeyRound },
  { id: "tasks", label: "Task Log", icon: Workflow },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "calendar", label: "Calendar", icon: CalendarRange },
  { id: "user-management", label: "User Management", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

export type ViewId = (typeof navigation)[number]["id"];

interface AppShellProps {
  children: ReactNode;
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

export function AppShell({ children, activeView, onViewChange }: AppShellProps) {
  const { role, user } = useNestor();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        await supabase
          .from("profiles")
          .update({ last_seen_at: null })
          .eq("id", user.id);
      } catch (e) {
        console.error("SignOut presence update failed:", e);
      }
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
  };

  const filteredNavigation = navigation.filter((item) => {
    if (item.id === "user-management") {
      return role === "admin";
    }
    return true;
  });

  const personalIds = ["dashboard", "tickets", "tasks", "calendar"];
  const personalNav = filteredNavigation.filter((item) => personalIds.includes(item.id));
  const centralizedNav = filteredNavigation.filter((item) => !personalIds.includes(item.id));

  /* ── Sidebar nav item (desktop vertical) ── */
  const renderSidebarItem = (item: typeof navigation[number]) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;
    return (
      <motion.button
        key={item.id}
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => onViewChange(item.id)}
        className={`relative flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[13px] font-medium w-full transition-all duration-200 ${
          isActive
            ? "bg-accent-purple/15 text-accent-purple font-semibold shadow-sm"
            : "text-text-muted hover:bg-white/8 hover:text-text-primary"
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="nav-active-pill-sidebar"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent-purple"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon size={16} strokeWidth={isActive ? 2.2 : 1.75} />
        <span>{item.label}</span>
      </motion.button>
    );
  };

  /* ── Top nav icon pill (tablet/mobile horizontal) ── */
  const renderTopItem = (item: typeof navigation[number]) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;
    return (
      <motion.button
        key={item.id}
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => onViewChange(item.id)}
        title={item.label}
        className={`relative flex flex-col items-center justify-center gap-1 rounded-[10px] px-2.5 py-1.5 transition-all duration-200 flex-shrink-0 min-w-[52px] ${
          isActive
            ? "bg-accent-purple/20 text-accent-purple"
            : "text-text-muted hover:bg-white/8 hover:text-text-primary"
        }`}
      >
        {isActive && (
          <motion.span
            layoutId="nav-active-pill-top"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-accent-purple"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Icon size={15} strokeWidth={isActive ? 2.2 : 1.75} />
        <span className="text-[9px] font-semibold leading-none truncate max-w-[48px]">{item.label}</span>
      </motion.button>
    );
  };

  return (
    <div className="min-h-screen text-text-secondary">

      {/* ── TABLET / MOBILE: Top Navbar ── */}
      <div className="lg:hidden sticky top-0 z-30 flex flex-col gap-0">
        {/* Brand bar */}
        <div className="flex items-center justify-between px-4 py-2 backdrop-blur-[20px] border-b dark:border-white/5 dark:bg-sidebar-bg/95">
          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--color-purple)] via-[var(--color-blue)] to-[var(--color-cyan)] text-sm font-bold text-white shadow-[var(--shadow-glow)] flex-shrink-0">
              N
              <span className="absolute inset-0 rounded-[10px] bg-white/10 pointer-events-none" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-text-primary leading-none">Nestor</p>
              <p className="text-[10px] text-text-soft leading-none mt-0.5">Work command center</p>
            </div>
          </div>

          {/* Logout button - compact */}
          {isSupabaseConfigured && user && (
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-[8px] border border-danger/30 bg-danger/10 px-3 py-1.5 text-[11px] font-bold text-danger hover:bg-danger hover:text-white transition-all cursor-pointer flex-shrink-0"
            >
              <LogOut size={12} />
              <span>Log Out</span>
            </button>
          )}
        </div>

        {/* Scrollable nav tabs */}
        <div className="overflow-x-auto scrollbar-none backdrop-blur-[20px] border-b dark:border-white/5 dark:bg-sidebar-bg/90">
          <div className="flex items-center gap-1 px-3 py-2 w-max min-w-full">
            {/* Personal section */}
            <div className="flex items-center gap-1">
              {personalNav.map(renderTopItem)}
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-white/10 mx-1 flex-shrink-0" />

            {/* Team section */}
            <div className="flex items-center gap-1">
              {centralizedNav.map(renderTopItem)}
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: Sidebar layout ── */}
      <div className="hidden lg:flex min-h-screen w-full p-4">
        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-[240px] rounded-[20px] border p-5 shadow-soft backdrop-blur-[20px] mr-5 sticky top-4 h-[calc(100vh-32px)] flex flex-col justify-between flex-shrink-0 dark:border-white/5 dark:bg-sidebar-bg"
        >
          {/* Top: brand + nav */}
          <div className="flex flex-col gap-0 overflow-y-auto min-h-0 flex-1">
            {/* Brand mark */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--color-purple)] via-[var(--color-blue)] to-[var(--color-cyan)] text-base font-bold text-white shadow-[var(--shadow-glow)] flex-shrink-0">
                N
                <span className="absolute inset-0 rounded-[14px] bg-white/10 pointer-events-none" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-text-primary leading-none">Nestor</p>
                <p className="text-[11px] text-text-soft mt-0.5 leading-none">Work command center</p>
              </div>
            </div>

            {/* Personal Modules */}
            <div className="mt-5 space-y-1.5 flex-shrink-0">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-text-soft px-3 mb-1 opacity-60">
                Personal Space
              </p>
              <nav className="flex flex-col gap-1 w-full">
                {personalNav.map(renderSidebarItem)}
              </nav>
            </div>

            {/* Centralized Modules */}
            <div className="mt-6 space-y-1.5 flex-shrink-0">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-text-soft px-3 mb-1 opacity-60">
                Team Centralized
              </p>
              <nav className="flex flex-col gap-1 w-full">
                {centralizedNav.map(renderSidebarItem)}
              </nav>
            </div>
          </div>

          {/* Bottom: logout + status */}
          <div className="mt-6 border-t border-slate-100 dark:border-white/5 pt-4 space-y-3 flex-shrink-0">
            {isSupabaseConfigured && user && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-btn border border-danger/20 bg-danger/10 py-2 text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all cursor-pointer"
              >
                <LogOut size={13} />
                <span>Log Out</span>
              </button>
            )}
            <p className="text-[9px] text-text-soft text-center opacity-60">
              {isSupabaseConfigured ? "Connected to Supabase Cloud" : "Running locally"}
            </p>
          </div>
        </motion.aside>

        {/* Main content */}
        <main className="flex-1 min-h-[calc(100vh-32px)]">
          <div className="py-1">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE/TABLET main content ── */}
      <main className="lg:hidden flex-1">
        <div className="p-3 py-4">
          {children}
        </div>
      </main>

    </div>
  );
}
