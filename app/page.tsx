"use client";

import { useState } from "react";
import { KeyRound, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { DashboardOverview } from "@/src/features/dashboard/components/dashboard-overview";
import { TaskModule } from "@/src/features/task/components/task-module";
import { TicketModule } from "@/src/features/ticket/components/ticket-module";
import { OemCaseModule } from "@/src/features/oem-case/components/oem-case-module";
import { ShiftRosterModule } from "@/src/features/shift-roster/components/shift-roster-module";
import { PasswordVaultModule } from "@/src/features/password-vault/components/password-vault-module";
import { CalendarModule } from "@/src/features/calendar/components/calendar-module";
import { SettingsPage } from "@/src/features/settings/components/settings-page";
import { ReportsModule } from "@/src/features/reports/components/reports-module";
import { UserManagementModule } from "@/src/features/user-management/components/user-management-module";
import { LoginPage } from "@/src/features/auth/components/login-page";
import { AppShell, type ViewId } from "@/src/shared/components/layout/app-shell";
import { useNestor } from "@/src/shared/context/nestor-context";
import { supabase, isSupabaseConfigured } from "@/src/shared/lib/supabase";

function ChangePasswordView({ onComplete }: { onComplete: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Complete the first-login flow server-side. This updates the credential
      // and profile status atomically and is restricted to the signed-in,
      // pending account.
      const { error } = await supabase!.rpc("complete_initial_password", {
        p_new_password: newPassword,
      });

      if (error) throw error;

      setSuccessMsg("Password changed successfully! Opening Nestor...");
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#080d16] relative overflow-hidden select-none">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-accent-purple/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md rounded-card border shadow-glow border-white/5 bg-[#0f172a]/80 backdrop-blur-md p-8 space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-purple/10 text-accent-purple mb-2 shadow-inner">
            <KeyRound size={26} />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            Set Your Password
          </h1>
          <p className="text-xs text-text-soft">
            This is your first login or your password has been reset by an administrator. Please set a secure password to proceed.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-input bg-danger/10 border border-danger/25 text-xs text-danger flex items-start gap-2">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-input bg-accent-cyan/10 border border-accent-cyan/25 text-xs text-accent-cyan flex items-start gap-2">
            <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password (min 6 chars)"
              className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424]/60 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-white dark:focus:bg-[#111c30] transition-all"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424]/60 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-white dark:focus:bg-[#111c30] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-3 text-sm font-bold text-white shadow-glow hover:scale-[1.02] transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Saving Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, status, setStatus } = useNestor();
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (isSupabaseConfigured && !user) {
    return <LoginPage />;
  }

  // Intercept the workflow if the account status is 'pending'
  if (isSupabaseConfigured && user && status === "pending") {
    return <ChangePasswordView onComplete={() => setStatus("active")} />;
  }

  return (
    <AppShell activeView={activeView} onViewChange={(view) => setActiveView(view)}>
      {activeView === "dashboard" ? (
        <DashboardOverview
          onViewChange={(view) => setActiveView(view)}
          onSelectTask={setSelectedTaskId}
          onSelectTicket={setSelectedTicketId}
        />
      ) : null}
      {activeView === "tasks" ? (
        <TaskModule
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      ) : null}
      {activeView === "tickets" ? (
        <TicketModule
          selectedTicketId={selectedTicketId}
          onSelectTicket={setSelectedTicketId}
        />
      ) : null}
      {activeView === "oem-cases" ? <OemCaseModule /> : null}
      {activeView === "shift-roster" ? <ShiftRosterModule /> : null}
      {activeView === "password-vault" ? <PasswordVaultModule /> : null}
      {activeView === "calendar" ? <CalendarModule /> : null}
      {activeView === "user-management" ? <UserManagementModule /> : null}
      {activeView === "settings" ? <SettingsPage /> : null}
      {activeView === "reports" ? <ReportsModule /> : null}
    </AppShell>
  );
}
