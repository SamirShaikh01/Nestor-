"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNestor } from "@/src/shared/context/nestor-context";
import {
  CalendarDays,
  Search,
  Users,
  Moon,
  Clock,
  Coffee,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Check,
  Edit3,
} from "lucide-react";
import type { ShiftPreset, RosterMember } from "../types";

export function ShiftRosterModule() {
  const {
    rosterMembers,
    rosterAssignments,
    shiftPresets,
    assignRosterShift,
    bulkAssignRosterShifts,
    saveRosterChanges,
    clearRosterMonth,
    addShiftPreset,
    role,
    username,
    shiftRequests,
    reviewShiftRequest,
  } = useNestor();

  const [activeTab, setActiveTab] = useState<"roster" | "requests">("roster");

  // Current selected Year & Month
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(6); // 6 = July (0-indexed)

  useEffect(() => {
    const today = new Date();
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  }, []);

  // Pending (unsaved) changes buffer: key = "employeeId_YYYY-MM-DD", value = shiftCode
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const pendingCount = Object.keys(pendingChanges).length;

  // Filters
  const [search, setSearch] = useState("");
  const [filterShiftCode, setFilterShiftCode] = useState("all");

  // Modals & Popovers state
  const [editingCell, setEditingCell] = useState<{ employeeId: string; date: string } | null>(null);

  // Bulk assignment state
  const [bulkMemberId, setBulkMemberId] = useState<string | null>(null);
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [bulkShiftCode, setBulkShiftCode] = useState("G");

  // Helper: Get days in selected month
  const daysInMonth = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth + 1, 0);
    const count = date.getDate();
    const days = [];
    for (let d = 1; d <= count; d++) {
      const dayDate = new Date(selectedYear, selectedMonth, d);
      const dayOfWeekStr = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      days.push({
        dayNumber: d,
        weekday: dayOfWeekStr,
        dateStr,
        isWeekend,
      });
    }
    return days;
  }, [selectedYear, selectedMonth]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const monthName = new Date(selectedYear, selectedMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Filtered Roster Members
  const filteredMembers = useMemo(() => {
    const members = rosterMembers.filter((m) => {
      const query = search.toLowerCase().trim();
      const matchSearch =
        !query ||
        m.name.toLowerCase().includes(query) ||
        m.employeeId.toLowerCase().includes(query);

      if (!matchSearch) return false;

      if (filterShiftCode !== "all") {
        // Check if member has this shift code anytime in the selected month
        const hasCode = daysInMonth.some(
          (d) => rosterAssignments[`${m.employeeId}_${d.dateStr}`] === filterShiftCode
        );
        if (!hasCode) return false;
      }

      return true;
    });

    members.sort((a, b) => {
      if (a.name.toLowerCase() === username?.toLowerCase()) return -1;
      if (b.name.toLowerCase() === username?.toLowerCase()) return 1;
      return 0;
    });

    return members;
  }, [rosterMembers, search, filterShiftCode, daysInMonth, rosterAssignments, username]);

  // Today's date string — must be the LOCAL calendar date, not UTC. Using
  // toISOString() here previously computed the UTC date, which is a day
  // behind local time for part of the day in timezones ahead of UTC (e.g.
  // IST) — so this card was looking up "today's" roster assignment under
  // yesterday's date and silently fell back to the default "G" (General)
  // shift, even for someone actually rostered on a different shift today.
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Today's Shifts summary for the cards
  const shiftsToday = useMemo(() => {
    const shiftCounts: Record<string, { count: number; members: string[]; name: string; bgHex: string; textHex: string }> = {};

    shiftPresets.forEach((preset) => {
      shiftCounts[preset.code] = { 
        count: 0, 
        members: [], 
        name: preset.name, 
        bgHex: preset.bgHex,
        textHex: preset.textHex
      };
    });

    rosterMembers.forEach((m) => {
      const key = `${m.employeeId}_${todayStr}`;
      // Mirror the matrix cells' own resolution order (pendingChanges wins
      // over the committed rosterAssignments) so an admin editing today's
      // shift sees this card update immediately, not only after Publish.
      const shiftCode = pendingChanges[key] ?? rosterAssignments[key] ?? "G";
      if (shiftCounts[shiftCode]) {
        shiftCounts[shiftCode].count++;
        shiftCounts[shiftCode].members.push(m.name);
      }
    });

    return Object.values(shiftCounts).filter(s => s.count > 0);
  }, [rosterMembers, rosterAssignments, pendingChanges, shiftPresets, todayStr]);

  // Quick lookup helper for shift preset
  const getShiftPreset = (code: string): ShiftPreset => {
    const found = shiftPresets.find((p) => p.code === code);
    if (found) return found;
    return {
      code,
      name: code,
      timeRange: "",
      bgHex: "#334155",
      textHex: "#ffffff",
    };
  };

  // Helper for active editing cell member and date details
  const editingMember = useMemo(() => {
    if (!editingCell) return null;
    return rosterMembers.find((m) => m.employeeId === editingCell.employeeId) || null;
  }, [editingCell, rosterMembers]);

  const editingCellDateFormatted = useMemo(() => {
    if (!editingCell) return "";
    const parts = editingCell.date.split("-").map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    return dateObj.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [editingCell]);

  const currentAssignedCode = useMemo(() => {
    if (!editingCell) return "";
    const key = `${editingCell.employeeId}_${editingCell.date}`;
    return pendingChanges[key] ?? rosterAssignments[key] ?? "G";
  }, [editingCell, rosterAssignments, pendingChanges]);

  // Handle cell shift update — accumulates into pendingChanges (NOT saved to DB yet)
  const handleSelectShiftForCell = (code: string) => {
    if (editingCell) {
      const key = `${editingCell.employeeId}_${editingCell.date}`;
      setPendingChanges((prev) => ({ ...prev, [key]: code }));
      setEditingCell(null);
    }
  };

  // Handle Bulk Shift Submit — accumulates into pendingChanges (NOT saved to DB yet)
  const handleApplyBulkShifts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMemberId || !bulkStartDate || !bulkEndDate) return;
    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);
    const curr = new Date(start);
    const batch: Record<string, string> = {};
    while (curr <= end) {
      const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, "0")}-${String(curr.getDate()).padStart(2, "0")}`;
      batch[`${bulkMemberId}_${dateStr}`] = bulkShiftCode;
      curr.setDate(curr.getDate() + 1);
    }
    setPendingChanges((prev) => ({ ...prev, ...batch }));
    setBulkMemberId(null);
  };

  // Publish Roster — commits ALL pending changes to state + DB
  const handlePublishRoster = async () => {
    if (pendingCount === 0) return;
    setIsSaving(true);
    try {
      await saveRosterChanges(pendingChanges);
      setPendingChanges({});
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setPendingChanges({});
  };

  return (
    <div className="space-y-6">
      {/* ── Header Toolbar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-card border p-5 shadow-soft md:flex-row md:items-center md:justify-between dark:border-white/5 dark:bg-white/5 light:border-slate-200 light:bg-white"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">MSS Operations</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Shift Roster</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Navigator */}
          <div className="flex items-center rounded-btn border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-2 py-1 shadow-soft">
            <button
              onClick={handlePrevMonth}
              className="rounded-btn p-1.5 text-text-soft hover:bg-slate-100 dark:hover:bg-white/10 hover:text-text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 text-xs font-bold text-text-primary uppercase tracking-wider">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="rounded-btn p-1.5 text-text-soft hover:bg-slate-100 dark:hover:bg-white/10 hover:text-text-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Publish Roster button — only visible for admins */}
          {role === "admin" && (
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handlePublishRoster}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-btn bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    <Check size={15} />
                    {isSaving ? "Saving..." : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelChanges}
                    disabled={isSaving}
                    className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    <X size={15} />
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </motion.div>

      {/* ── Today's Shifts Summary ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {shiftsToday.map((shift, idx) => (
          <motion.div
            key={idx}
            whileHover={{ y: -4, scale: 1.02 }}
            className="relative overflow-hidden rounded-[20px] border p-5 flex flex-col justify-between dark:bg-[#0c1222] light:bg-white transition-all duration-300"
            style={{
              borderColor: `${shift.bgHex}30`,
              boxShadow: `0 8px 30px -6px ${shift.bgHex}25, inset 0 0 20px -5px ${shift.bgHex}10`
            }}
          >
            {/* Background accent glow */}
            <div 
              className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-[30px] opacity-20 pointer-events-none"
              style={{ backgroundColor: shift.bgHex }}
            />
            
            <div className="relative flex items-start justify-between mb-4">
              <span className="text-[11px] font-extrabold text-text-primary uppercase tracking-[0.15em] opacity-90 leading-snug pr-2">
                {shift.name}
              </span>
              <div 
                className="w-10 h-10 rounded-[12px] flex items-center justify-center text-sm font-black shadow-lg flex-shrink-0"
                style={{ 
                  backgroundColor: shift.bgHex, 
                  color: shift.textHex,
                  boxShadow: `0 4px 12px ${shift.bgHex}50`
                }}
              >
                {shift.count}
              </div>
            </div>
            
            <div className="relative mt-auto">
              <p className="text-[9px] font-bold text-text-soft/60 uppercase tracking-widest mb-1.5">Assigned Members</p>
              <div className="text-[20px] font-semibold text-text-primary line-clamp-2 leading-relaxed" title={shift.members.join(", ")}>
                {shift.members.length > 0 ? shift.members.join(", ") : "—"}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Admin Tab Switcher */}
      {role === "admin" && (
        <div className="flex items-center gap-1 border-b border-white/5 pb-1">
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === "roster"
                ? "border-accent-purple text-accent-purple"
                : "border-transparent text-text-soft hover:text-text-primary"
            }`}
          >
            Roster Matrix
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "requests"
                ? "border-accent-purple text-accent-purple"
                : "border-transparent text-text-soft hover:text-text-primary"
            }`}
          >
            Change Requests
            {shiftRequests.filter((r) => r.status === "pending").length > 0 && (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                {shiftRequests.filter((r) => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>
      )}

      {activeTab === "roster" ? (
        <>
          {/* ── Filters & Search Bar ── */}
      <div className="flex flex-col gap-3 rounded-card border p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          <div className="flex max-w-sm flex-1 items-center gap-2 rounded-input border px-3.5 py-2 transition-colors focus-within:border-accent-cyan dark:border-white/10 dark:bg-white/5 light:border-slate-200 light:bg-slate-50">
            <Search size={15} className="text-text-soft" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Employee Name or ID (e.g. 3894)..."
              className="w-full bg-transparent text-xs text-text-primary outline-none placeholder:text-text-soft"
            />
          </div>

          {/* Filter by Shift Code */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-soft font-medium hidden md:inline">Filter Shift:</span>
            <select
              value={filterShiftCode}
              onChange={(e) => setFilterShiftCode(e.target.value)}
              className="rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-cyan"
            >
              <option value="all">All Shifts</option>
              {shiftPresets.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} ({p.name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Assign Trigger */}
        {role === "admin" && (
          <button
            onClick={() => {
              if (rosterMembers.length > 0) {
                setBulkMemberId(rosterMembers[0].employeeId);
                setBulkStartDate(daysInMonth[0].dateStr);
                setBulkEndDate(daysInMonth[Math.min(4, daysInMonth.length - 1)].dateStr);
              }
            }}
            className="flex items-center gap-1.5 rounded-btn border border-accent-cyan/30 bg-accent-cyan/10 px-3.5 py-2 text-xs font-semibold text-accent-cyan hover:bg-accent-cyan/20 transition-all cursor-pointer"
          >
            <SlidersHorizontal size={14} /> Bulk Shift Assign
          </button>
        )}
      </div>

      {/* ── Bulk Shift Assign Drawer / Bar ── */}
      <AnimatePresence>
        {bulkMemberId && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleApplyBulkShifts}
            className="rounded-card border border-accent-cyan/40 bg-accent-cyan/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent-cyan flex items-center gap-2">
                <SlidersHorizontal size={15} /> Bulk Assign Shift Schedule
              </h4>
              <button
                type="button"
                onClick={() => setBulkMemberId(null)}
                className="text-text-soft hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-text-soft mb-1">Select Member</label>
                <select
                  value={bulkMemberId}
                  onChange={(e) => setBulkMemberId(e.target.value)}
                  className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none"
                >
                  {rosterMembers.map((m) => (
                    <option key={m.employeeId} value={m.employeeId}>
                      {m.name} ({m.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-text-soft mb-1">Start Date</label>
                <input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-text-soft mb-1">End Date</label>
                <input
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-text-soft mb-1">Shift Preset</label>
                <div className="flex gap-2">
                  <select
                    value={bulkShiftCode}
                    onChange={(e) => setBulkShiftCode(e.target.value)}
                    className="flex-1 rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none"
                  >
                    {shiftPresets.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-btn bg-accent-cyan px-4 py-1.5 text-xs font-bold text-black hover:scale-105 transition-all uppercase"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ── Interactive Roster Table Grid ── */}
      <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              {/* Row 1: Month & Weekday Header */}
              <tr className="border-b bg-slate-100/70 dark:border-white/5 dark:bg-white/[0.03] text-[10px] font-bold text-text-soft uppercase">
                <th className="sticky left-0 z-20 py-2 px-4 bg-slate-100 dark:bg-[#0e1626] border-r dark:border-white/5 min-w-[180px]">
                  Employee Name
                </th>
                {daysInMonth.map((d) => (
                  <th
                    key={d.dateStr}
                    className={`py-1.5 px-1 text-center min-w-[36px] max-w-[42px] border-r dark:border-white/5 ${
                      d.isWeekend ? "bg-amber-500/10 text-amber-500" : ""
                    }`}
                  >
                    {d.weekday}
                  </th>
                ))}
                <th className="py-2 px-3 text-center border-l dark:border-white/5 min-w-[100px]">
                  Summary
                </th>
              </tr>

              {/* Row 2: Date Number Header */}
              <tr className="border-b bg-slate-50 dark:border-white/5 dark:bg-white/[0.01] text-[11px] font-extrabold text-text-primary">
                <th className="sticky left-0 z-20 py-2 px-4 bg-slate-50 dark:bg-[#0e1626] border-r dark:border-white/5 font-mono">
                  Employee ID
                </th>
                {daysInMonth.map((d) => (
                  <th
                    key={d.dateStr}
                    className={`py-1.5 px-1 text-center border-r dark:border-white/5 font-mono ${
                      d.isWeekend ? "bg-amber-500/5 text-amber-600 dark:text-amber-400" : ""
                    }`}
                  >
                    {String(d.dayNumber).padStart(2, "0")}
                  </th>
                ))}
                <th className="py-2 px-3 text-center text-[9px] text-text-soft uppercase tracking-wider border-l dark:border-white/5">
                  OFF / N / L
                </th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-white/5 text-xs">
              {filteredMembers.map((member) => {
                let offCount = 0;
                let nightCount = 0;
                let leaveCount = 0;

                return (
                  <tr key={member.employeeId} className="group hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                    {/* Employee Info Column (Sticky Left) */}
                    <td className="sticky left-0 z-10 py-2.5 px-4 bg-white dark:bg-[#090d16] border-r dark:border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-text-primary block text-xs">{member.name}</span>
                          <span className="font-mono text-[10px] text-accent-cyan block font-bold">
                            ID: {member.employeeId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Date Shift Cells */}
                    {daysInMonth.map((d) => {
                      // Merge committed assignments with local pending changes
                      const pendingKey = `${member.employeeId}_${d.dateStr}`;
                      const pendingCode = pendingChanges[pendingKey];
                      const code = pendingCode ?? rosterAssignments[`${member.employeeId}_${d.dateStr}`] ?? "G";
                      const preset = getShiftPreset(code);
                      const hasPending = !!pendingCode;

                      if (code === "WO") offCount++;
                      if (code === "N") nightCount++;
                      if (code === "L") leaveCount++;

                      const isEditingThisCell =
                        editingCell?.employeeId === member.employeeId && editingCell?.date === d.dateStr;

                      return (
                        <td
                          key={d.dateStr}
                          onClick={() => {
                            if (role === "admin") {
                              setEditingCell({ employeeId: member.employeeId, date: d.dateStr });
                            }
                          }}
                          className={`py-1 px-1 text-center border-r dark:border-white/5 transition-all relative ${
                            role === "admin" ? "cursor-pointer hover:opacity-80" : ""
                          } ${
                            d.isWeekend ? "bg-slate-500/[0.03]" : ""
                          }`}
                        >
                          <span
                            className="inline-flex items-center justify-center rounded px-1.5 py-1 text-[10px] font-extrabold w-full shadow-sm"
                            style={{
                              backgroundColor: preset.bgHex,
                              color: preset.textHex,
                            }}
                          >
                            {code}
                          </span>
                          {/* Unsaved-change dot indicator */}
                          {hasPending && (
                            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
                          )}
                        </td>
                      );
                    })}

                    {/* Summary Counts Column */}
                    <td className="py-2 px-3 text-center border-l dark:border-white/5 font-mono text-[10px]">
                      <div className="flex items-center justify-center gap-1.5 font-bold">
                        <span className="text-amber-500" title="Weekly Offs">{offCount}WO</span>
                        <span className="text-accent-purple" title="Night Shifts">{nightCount}N</span>
                        <span className="text-red-500" title="Leaves">{leaveCount}L</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 2} className="py-12 text-center text-xs text-text-muted italic">
                    No team members found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Shift Legend & Timings Footer Bar ── */}
      <div className="rounded-card border p-4 shadow-soft space-y-3 dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-2">
          <CalendarIcon size={14} className="text-accent-cyan" /> Shift Presets &amp; Timing Legend
        </h4>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {shiftPresets.map((p) => (
            <div
              key={p.code}
              className="flex flex-col justify-between rounded-input border p-2.5 shadow-sm"
              style={{
                backgroundColor: p.bgHex,
                color: p.textHex,
                borderColor: "rgba(0,0,0,0.1)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold">{p.code}</span>
                <span className="text-[9px] font-medium opacity-80">{p.name}</span>
              </div>
              <span className="text-[9px] font-mono mt-1 font-semibold opacity-90">{p.timeRange}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Roster tab end */}
        </>
      ) : (
        <div className="rounded-card border p-6 shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg light:bg-white light:border-slate-200">
          <h3 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
            <CalendarIcon size={18} className="text-accent-purple" />
            Shift Change Requests
          </h3>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b dark:border-white/5 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Requested Shift</th>
                  <th className="py-3 px-4">Reason for Request</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-white/5 text-xs">
                {shiftRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.01]">
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {req.employeeName}
                      <span className="block text-[10px] text-text-soft font-mono">ID: {req.employeeId}</span>
                    </td>
                    <td className="py-4 px-4 font-mono font-semibold text-text-primary">
                      {req.dateStr}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block rounded bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 text-[10px] font-extrabold text-accent-cyan">
                        {req.requestedShiftCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-xs text-text-soft leading-normal whitespace-pre-wrap break-words">
                      {req.reason}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`rounded-badge px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'approved' ? 'bg-success/20 text-success' :
                        req.status === 'declined' ? 'bg-danger/20 text-danger' :
                        'bg-amber-500/20 text-amber-500 animate-pulse'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {req.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => reviewShiftRequest(req.id, 'approved')}
                            className="rounded bg-success/15 hover:bg-success border border-success/35 py-1 px-2.5 text-[10px] font-bold text-success hover:text-white transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewShiftRequest(req.id, 'declined')}
                            className="rounded bg-danger/15 hover:bg-danger border border-danger/35 py-1 px-2.5 text-[10px] font-bold text-danger hover:text-white transition-all cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-text-muted italic">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {shiftRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-text-muted italic">
                      No shift change requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Fixed Admin Shift Selection Modal Overlay (z-50, always on top) ── */}
      <AnimatePresence>
        {editingCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCell(null)}
              className="absolute inset-0 bg-black/65 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="z-10 w-full max-w-sm rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0f172a] light:bg-white p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b pb-3 mb-3 dark:border-white/10">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Assign Roster Shift</h4>
                  <p className="text-xs text-accent-cyan font-mono font-semibold mt-0.5">
                    {editingMember?.name} (ID: {editingMember?.employeeId})
                  </p>
                </div>
                <button
                  onClick={() => setEditingCell(null)}
                  className="rounded-btn p-1 text-text-soft hover:bg-white/10 hover:text-text-primary"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 text-xs text-text-soft flex items-center gap-1.5 font-medium">
                <CalendarIcon size={14} className="text-accent-cyan" />
                <span>Date: <strong className="text-text-primary">{editingCellDateFormatted}</strong></span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {shiftPresets.map((p) => {
                  const isCurrent = currentAssignedCode === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleSelectShiftForCell(p.code)}
                      className={`flex items-center justify-between rounded-input p-2.5 text-xs font-bold border transition-all duration-150 cursor-pointer ${
                        isCurrent ? "ring-2 ring-accent-cyan scale-[1.02]" : "hover:scale-[1.02]"
                      }`}
                      style={{
                        backgroundColor: p.bgHex,
                        color: p.textHex,
                        borderColor: "rgba(0,0,0,0.15)",
                      }}
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-extrabold">{p.code}</span>
                        <span className="text-[9px] opacity-90">{p.name}</span>
                      </div>
                      {isCurrent && <Check size={16} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Modal */}
    </div>
  );
}
