"use client";

import { useState } from "react";
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
import { isSupabaseConfigured } from "@/src/shared/lib/supabase";

export default function HomePage() {
  const { user } = useNestor();
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedOemCaseId, setSelectedOemCaseId] = useState<string | null>(null);

  if (isSupabaseConfigured && !user) {
    return <LoginPage />;
  }

  return (
    <AppShell activeView={activeView} onViewChange={(view) => setActiveView(view)}>
      {activeView === "dashboard" ? (
        <DashboardOverview
          onViewChange={(view) => setActiveView(view)}
          onSelectTask={setSelectedTaskId}
          onSelectTicket={setSelectedTicketId}
          onSelectOemCase={setSelectedOemCaseId}
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
      {activeView === "oem-cases" ? (
        <OemCaseModule
          selectedOemCaseId={selectedOemCaseId}
          onSelectOemCase={setSelectedOemCaseId}
        />
      ) : null}
      {activeView === "shift-roster" ? <ShiftRosterModule /> : null}
      {activeView === "password-vault" ? <PasswordVaultModule /> : null}
      {activeView === "calendar" ? <CalendarModule /> : null}
      {activeView === "user-management" ? <UserManagementModule /> : null}
      {activeView === "settings" ? <SettingsPage /> : null}
      {activeView === "reports" ? <ReportsModule /> : null}
    </AppShell>
  );
}
