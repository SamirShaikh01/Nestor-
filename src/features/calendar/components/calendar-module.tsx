"use client";

import { useState, useMemo, useEffect } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, ClipboardList, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import { ShiftFormModal } from "./shift-form-modal";
import { getShiftBadgeClasses, getShiftHexColor } from "@/src/shared/lib/theme-utils";
import { isSupabaseConfigured } from "@/src/shared/lib/supabase";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarModule() {
  const {
    tasks,
    tickets,
    shiftAssignments,
    shiftsRegistry,
    rosterAssignments,
    shiftPresets,
    employeeId,
  } = useNestor();

  const { todayStr, calendarHeaderDate } = useMemo(() => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const calendarHeaderDate = `${weekdays[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    return { todayStr, calendarHeaderDate };
  }, []);

  // Selected calendar month/year
  const [selectedMonth, setSelectedMonth] = useState(6); // 6 = July (0-indexed)
  const [selectedYear, setSelectedYear] = useState(2026);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState("");

  // Hydration and View Mode states
  const [isMounted, setIsMounted] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"month" | "day">("month");
  
  // Day view states
  const [selectedDayDate, setSelectedDayDate] = useState<string>("2026-07-08"); // default fallback
  const [fortnightStart, setFortnightStart] = useState<string>("2026-07-01"); // default fallback

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsMounted(true);
    // Initialize active day and fortnight bounds post-mounting
    const today = new Date();
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
    
    const todayStrStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedDayDate(todayStrStr);

    const rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - 7);
    const rangeStartStr = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-${String(rangeStart.getDate()).padStart(2, "0")}`;
    setFortnightStart(rangeStartStr);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Slider navigation
  const handlePrevFortnight = () => {
    const start = new Date(fortnightStart);
    start.setDate(start.getDate() - 15);
    const prevStartStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    setFortnightStart(prevStartStr);
  };

  const handleNextFortnight = () => {
    const start = new Date(fortnightStart);
    start.setDate(start.getDate() + 15);
    const nextStartStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    setFortnightStart(nextStartStr);
  };

  // Get active 15 days in strip
  const fortnightDays = useMemo(() => {
    const list = [];
    const start = new Date(fortnightStart);
    for (let i = 0; i < 15; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
      
      const weekdaysShort = ["S", "M", "T", "W", "T", "F", "S"];
      const weekdayLetter = weekdaysShort[current.getDay()];
      const hasTasks = tasks.some((t) => t.date === dateKey);

      list.push({
        dateKey,
        dayNum: String(current.getDate()).padStart(2, "0"),
        weekdayLetter,
        monthName: current.toLocaleString("default", { month: "short" }),
        year: current.getFullYear(),
        rawDate: current,
        hasTasks,
      });
    }
    return list;
  }, [fortnightStart, tasks]);

  // Format header range for day-strip
  const fortnightRangeText = useMemo(() => {
    if (fortnightDays.length === 0) return "";
    const first = fortnightDays[0];
    const last = fortnightDays[fortnightDays.length - 1];
    if (first.monthName === last.monthName) {
      return `${first.monthName} ${first.dayNum} - ${last.dayNum}, ${first.year}`;
    }
    return `${first.monthName} ${first.dayNum} - ${last.monthName} ${last.dayNum}, ${first.year}`;
  }, [fortnightDays]);

  interface ScheduleItem {
    id: number;
    title: string;
    category: string;
    status: string;
    startTime: string;
    endTime: string;
    duration: number;
  }

  const { activeTimers } = useNestor();

  // Retrieve task sessions chronologically for selected day
  const selectedDaySessions = useMemo(() => {
    const list: ScheduleItem[] = [];
    const dayTasks = tasks.filter((t) => t.date === selectedDayDate);
    const isToday = selectedDayDate === todayStr;

    const calculateDiffMinutes = (startStr: string, endStr: string) => {
      const [sh, sm] = startStr.split(":").map(Number);
      const [eh, em] = endStr.split(":").map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
      return (eh * 60 + em) - (sh * 60 + sm);
    };

    dayTasks.forEach((task) => {
      // Completed logged sessions
      if (Array.isArray(task.sessions)) {
        task.sessions.forEach((sess) => {
          const parts = sess.split("-");
          if (parts.length === 2) {
            const start = parts[0].trim();
            const end = parts[1].trim();
            list.push({
              id: task.id,
              title: task.title,
              category: task.category,
              status: task.status,
              startTime: start,
              endTime: end,
              duration: calculateDiffMinutes(start, end),
            });
          }
        });
      }

      // Active running session
      if (isToday && activeTimers && activeTimers[task.id]) {
        const start = activeTimers[task.id];
        const now = new Date();
        const end = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        list.push({
          id: task.id,
          title: task.title,
          category: task.category,
          status: "tracking",
          startTime: start,
          endTime: end,
          duration: calculateDiffMinutes(start, end),
        });
      }
    });

    return list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, selectedDayDate, todayStr, activeTimers]);

  // Category visual styles helper
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Meeting":
        return { border: "border-l-blue-500", text: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/5" };
      case "Learning":
        return { border: "border-l-purple-500", text: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/5" };
      case "Research":
        return { border: "border-l-amber-500", text: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/5" };
      case "Documentation":
        return { border: "border-l-cyan-500", text: "text-cyan-500 dark:text-cyan-400", bg: "bg-cyan-500/5" };
      case "Operations":
        return { border: "border-l-red-500", text: "text-red-500 dark:text-red-400", bg: "bg-red-500/5" };
      case "Automation":
        return { border: "border-l-teal-500", text: "text-teal-500 dark:text-teal-400", bg: "bg-teal-500/5" };
      case "Health Check":
        return { border: "border-l-emerald-500", text: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/5" };
      case "Personal":
        return { border: "border-l-pink-500", text: "text-pink-500 dark:text-pink-400", bg: "bg-pink-500/5" };
      default:
        return { border: "border-l-slate-500", text: "text-slate-500 dark:text-slate-400", bg: "bg-slate-500/5" };
    }
  };

  // Years filter options
  const years = [2026, 2027, 2028, 2029, 2030,2031,2032];

  // Helper: Format date as YYYY-MM-DD
  const formatDateKey = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // Helper: Calculate calendar cells grid
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();

    const cells = [];

    // Fill previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayVal = prevMonthDays - i;
      const prevMonthIdx = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevYearVal = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      cells.push({
        day: dayVal,
        isCurrentMonth: false,
        dateKey: formatDateKey(prevYearVal, prevMonthIdx, dayVal),
      });
    }

    // Fill current month days
    for (let day = 1; day <= totalDays; day++) {
      cells.push({
        day,
        isCurrentMonth: true,
        dateKey: formatDateKey(selectedYear, selectedMonth, day),
      });
    }

    // Fill next month padding days to complete standard 42 cell grid (6 rows)
    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonthIdx = selectedMonth === 11 ? 0 : selectedMonth + 1;
      const nextYearVal = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
      cells.push({
        day,
        isCurrentMonth: false,
        dateKey: formatDateKey(nextYearVal, nextMonthIdx, day),
      });
    }

    return cells;
  }, [selectedMonth, selectedYear]);

  // Handle Month navigations
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  // Helper: Get shift timing details for formatting
  const getShiftDetails = (shiftName: string) => {
    const matched = shiftsRegistry.find((s) => s.name === shiftName);
    const timingLabel = matched ? ` (${matched.timeRange})` : "";
    return {
      label: `${shiftName}${timingLabel}`,
      color: getShiftBadgeClasses(shiftName)
    };
  };

  // Only the true offline/no-backend demo mode falls back to the legacy
  // in-memory `shiftAssignments` map. When Supabase IS configured but
  // `employeeId` just hasn't finished loading yet (async profile fetch), we
  // must NOT fall back to that map — it's unscoped, shared browser-tab state
  // that can carry over from a previous account's session and briefly (or
  // permanently, if employeeId never resolves) show someone else's shifts.
  const getResolvedShiftName = (dateStr: string): string => {
    if (isSupabaseConfigured) {
      if (!employeeId) return ""; // profile still loading — show nothing, not stale data
      const code = rosterAssignments[`${employeeId}_${dateStr}`];
      if (code) {
        if (code === "WO") return "Week Off";
        if (code === "L") return "Leave";
        const preset = shiftPresets.find((p) => p.code === code);
        if (preset) return preset.name;
      }
      return "";
    } else {
      return shiftAssignments[dateStr]?.shiftName || "";
    }
  };

  // Month Statistics Calculations
  const monthStats = useMemo(() => {
    let daysWorked = 0;
    let weekOffs = 0;
    let leaves = 0;

    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

    if (isSupabaseConfigured) {
      if (!employeeId) return { daysWorked: 0, weekOffs: 0, leaves: 0 }; // profile still loading
      const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const dd = String(day).padStart(2, "0");
        const dateStr = `${prefix}-${dd}`;
        const shiftName = getResolvedShiftName(dateStr);
        if (shiftName) {
          if (shiftName === "Leave") leaves++;
          else if (shiftName === "Week Off") weekOffs++;
          else daysWorked++;
        }
      }
    } else {
      Object.entries(shiftAssignments).forEach(([dateStr, assign]) => {
        if (dateStr.startsWith(prefix)) {
          if (assign.shiftName === "Leave") leaves++;
          else if (assign.shiftName === "Week Off") weekOffs++;
          else daysWorked++;
        }
      });
    }

    return { daysWorked, weekOffs, leaves };
  }, [shiftAssignments, rosterAssignments, shiftPresets, employeeId, selectedMonth, selectedYear]);

  // Tomorrow's shift calculation
  const tomorrowShift = useMemo(() => {
    const today = new Date(todayStr);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().split("T")[0];

    const shiftName = getResolvedShiftName(tomorrowKey);
    if (shiftName) {
      if (shiftName === "Leave") return "Leave (Vacation)";
      if (shiftName === "Week Off") return "Week Off (Holiday)";
      
      const matchedPreset = shiftPresets.find((p) => p.name === shiftName);
      if (matchedPreset) {
        return `${shiftName} (${matchedPreset.timeRange})`;
      }
      const matchedLocal = shiftsRegistry.find((s) => s.name === shiftName);
      return `${shiftName} (${matchedLocal?.timeRange || ""})`;
    }
    return "Not Scheduled";
  }, [shiftAssignments, rosterAssignments, shiftPresets, shiftsRegistry, todayStr, employeeId]);

  const handleCellClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header panel */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border border-white/5 bg-white/5 p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Calendar & Shifts</h2>
          <span className="text-sm text-text-muted hidden sm:inline">•</span>
          <p className="text-xs sm:text-sm text-text-muted">{calendarHeaderDate}</p>
        </div>
        
        {/* Top-right filters */}
        <div className="flex items-center gap-3 relative z-30">
          {isMounted && (
            <button
              type="button"
              onClick={() => setCalendarMode(calendarMode === "month" ? "day" : "month")}
              className="rounded-btn bg-gradient-to-r from-accent-cyan to-accent-blue px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
            >
              <CalendarDays size={13} />
              {calendarMode === "month" ? "Day View" : "Month View"}
            </button>
          )}

          {calendarMode === "month" && (
            <CustomSelect
              value={String(selectedYear)}
              onChange={(val) => handleYearChange(Number(val))}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
              width="w-[110px]"
              className="font-bold text-xs"
            />
          )}
        </div>
      </motion.div>

      {/* Summary statistics & tomorrow's shift glance */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-transparent bg-card-bg p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-[18px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Days Worked (Month)</p>
          <p className="mt-2 text-2xl font-semibold text-accent-cyan">{monthStats.daysWorked}</p>
        </div>
        <div className="rounded-[16px] border border-transparent bg-card-bg p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-[18px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Week Offs (Month)</p>
          <p className="mt-2 text-2xl font-semibold text-success">{monthStats.weekOffs}</p>
        </div>
        <div className="rounded-[16px] border border-transparent bg-card-bg p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-[18px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Leaves Taken (Month)</p>
          <p className="mt-2 text-2xl font-semibold text-danger">{monthStats.leaves}</p>
        </div>
        <div className="rounded-[16px] border border-transparent bg-gradient-to-r from-accent-purple/15 to-accent-cyan/10 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-[18px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Tomorrow&apos;s Shift</p>
          <p className="mt-2 text-sm font-semibold text-text-primary truncate">{tomorrowShift}</p>
        </div>
      </div>

      {/* Full Month / Day Calendar Pane */}
      {calendarMode === "month" ? (
        <div className="rounded-card border p-6 shadow-soft backdrop-blur-[18px] space-y-4
          dark:border-white/5 dark:bg-card-bg">
          {/* Month controller */}
          <div className="flex items-center justify-between border-b pb-4 dark:border-white/5">
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <CalendarDays size={18} className="text-accent-purple" />
              {MONTHS[selectedMonth]} {selectedYear}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-btn border p-2 text-text-muted transition-colors cursor-pointer
                  dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:text-text-primary"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-btn border p-2 text-text-muted transition-colors cursor-pointer
                  dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:text-text-primary"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Calendar Grid Container */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[650px]">
              {/* Weekdays header */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-text-soft pb-2 border-b dark:border-white/5">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid days */}
              <div className="grid grid-cols-7 gap-2 mt-3">
                {calendarCells.map((cell, idx) => {
                  const isToday = cell.dateKey === todayStr;
                  const shiftName = getResolvedShiftName(cell.dateKey);
                  const shiftFormat = shiftName ? getShiftDetails(shiftName) : null;

                  // Find in/out times for display
                  let displayTimings = "";
                  if (shiftName && shiftName !== "Leave" && shiftName !== "Week Off") {
                    if (isSupabaseConfigured) {
                      const code = employeeId ? rosterAssignments[`${employeeId}_${cell.dateKey}`] : undefined;
                      const preset = shiftPresets.find((p) => p.code === code);
                      if (preset) {
                        displayTimings = preset.timeRange;
                      }
                    } else {
                      const localAssign = shiftAssignments[cell.dateKey];
                      if (localAssign) {
                        displayTimings = `${localAssign.inTime} - ${localAssign.outTime}`;
                      }
                    }
                  }

                  const dayTasks = tasks.filter((t) => t.date === cell.dateKey);
                  const dayTickets = tickets.filter((t) => t.date === cell.dateKey);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleCellClick(cell.dateKey)}
                      className={`min-h-[105px] rounded-[14px] border p-2 flex flex-col justify-between transition-all cursor-pointer
                        ${
                          isToday
                            ? "border-accent-blue/50 dark:border-accent-blue/40 bg-accent-blue/10 dark:bg-accent-blue/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:shadow-[0_0_20px_rgba(59,130,246,0.25)] backdrop-blur-[6px] ring-1 ring-accent-blue/30"
                            : cell.isCurrentMonth
                              ? "dark:border-white/10 dark:bg-[#0f1524]/60 dark:hover:bg-[#131b2f] dark:hover:border-white/20"
                              : "dark:border-white/5 dark:bg-white/[0.01] dark:hover:bg-white/[0.03] dark:opacity-30"
                        }`}
                    >
                      {/* Header: Day number & today tag */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${
                          cell.isCurrentMonth ? "text-text-primary" : "text-text-soft"
                        }`}>
                          {cell.day}
                        </span>
                        {isToday && (
                          <span className="rounded-badge bg-accent-purple/20 px-1.5 py-0.5 text-[9px] font-bold text-accent-purple tracking-wider uppercase">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Shift badge display */}
                      <div className="my-1.5">
                        {shiftFormat ? (
                          <div className={`rounded-badge border px-2 py-1 text-[10px] font-semibold leading-tight flex flex-col justify-center items-center text-center ${shiftFormat.color}`}>
                            <span className="font-bold block truncate max-w-full">{shiftName}</span>
                            {displayTimings && (
                              <span className="text-[8px] opacity-80 font-mono mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                {displayTimings}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-6" /> // spacer
                        )}
                      </div>

                      {/* Footer: Daily activity counts */}
                      <div className="flex items-center gap-1.5 text-[9px] text-text-soft font-mono">
                        {dayTasks.length > 0 && (
                          <span className="flex items-center gap-0.5 bg-accent-purple/10 px-1 rounded text-accent-purple" title={`${dayTasks.length} Tasks`}>
                            <ClipboardList size={8} /> {dayTasks.length}t
                          </span>
                        )}
                        {dayTickets.length > 0 && (
                          <span className="flex items-center gap-0.5 bg-accent-cyan/10 px-1 rounded text-accent-cyan" title={`${dayTickets.length} Tickets`}>
                            <Ticket size={8} /> {dayTickets.length}tk
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Shift Legend — dynamically generated from shiftsRegistry */}
            <div className="mt-4 flex flex-wrap gap-3 border-t pt-4 text-xs dark:border-white/5">
              {[
                ...shiftsRegistry.map((s) => ({ name: s.name, timing: s.timeRange })),
                { name: "Week Off", timing: "" },
                { name: "Leave", timing: "" },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getShiftHexColor(item.name) }}
                  />
                  <span className="text-text-muted">
                    {item.name}{item.timing ? ` (${item.timing})` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-white/5 bg-card-bg p-6 shadow-soft backdrop-blur-[18px] space-y-6">
          {/* Day View Header (slider controls) */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <CalendarDays size={18} className="text-accent-cyan" />
                Schedule Timeline
              </h3>
              <p className="text-xs text-text-soft mt-0.5 font-semibold">
                Assignments ({fortnightRangeText})
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevFortnight}
                className="rounded-btn border border-white/10 bg-white/5 p-2 text-text-muted hover:border-white/20 hover:text-text-primary transition-colors"
                title="Previous 15 Days"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextFortnight}
                className="rounded-btn border border-white/10 bg-white/5 p-2 text-text-muted hover:border-white/20 hover:text-text-primary transition-colors"
                title="Next 15 Days"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* 15-Day horizontal sliding list */}
          <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
            <div className="flex items-center gap-2.5 min-w-[700px] justify-between px-1">
              {fortnightDays.map((day) => {
                const isSelected = day.dateKey === selectedDayDate;
                const isToday = day.dateKey === todayStr;

                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDayDate(day.dateKey)}
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all duration-300 w-11 flex-shrink-0 relative ${
                      isSelected
                        ? "border-accent-cyan/40 bg-accent-cyan/15 text-text-primary shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                        : "border-white/5 bg-[#0f1524]/60 hover:bg-[#131b2f] text-text-soft"
                    }`}
                  >
                    {/* Weekday name */}
                    <span className="text-[10px] uppercase font-bold text-text-muted block">
                      {day.weekdayLetter}
                    </span>
                    {/* Day number */}
                    <span className="text-sm font-extrabold tracking-tight mt-1">
                      {day.dayNum}
                    </span>
                    
                    {/* Task Indicators */}
                    <div className="flex justify-center gap-0.5 mt-1.5 h-1">
                      {day.hasTasks && (
                        <span className="w-1 h-1 rounded-full bg-accent-cyan animate-pulse" />
                      )}
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vertical Timeline Scheduling */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-text-soft uppercase tracking-wider">
                Daily Timeline ({selectedDayDate})
              </h4>
            </div>

            {selectedDaySessions.length > 0 ? (
              <div className="relative border-l border-white/10 pl-6 ml-3 space-y-6">
                {selectedDaySessions.map((session, sidx) => {
                  const colors = getCategoryColor(session.category);
                  return (
                    <div key={sidx} className="relative">
                      {/* Glowing dot on timeline */}
                      <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1020] bg-accent-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />

                      {/* Timeline card row */}
                      <div className="grid grid-cols-[110px_1fr] gap-4 items-start">
                        {/* Left: Time Range */}
                        <div className="flex flex-col text-xs font-mono font-bold text-text-soft pt-1">
                          <span>{session.startTime}</span>
                          <span className="text-[10px] text-text-muted">to {session.endTime}</span>
                        </div>

                        {/* Right: Card Details */}
                        <div className={`rounded-card border border-white/5 p-3 flex items-center justify-between gap-3 ${colors.bg} border-l-2 ${colors.border}`}>
                          <div>
                            <span className="text-xs font-bold text-text-primary block leading-snug">
                              {session.title}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-text-muted font-semibold uppercase">
                                {session.category}
                              </span>
                              <span className="text-[10px] text-text-muted">•</span>
                              <span className="text-[10px] text-text-muted font-mono">
                                {session.duration} mins logged
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold rounded-badge px-2 py-0.5 uppercase tracking-wide ${
                              session.status === "completed"
                                ? "bg-success/20 text-success"
                                : session.status === "tracking"
                                ? "bg-accent-cyan/20 text-accent-cyan animate-pulse"
                                : "bg-white/5 text-text-soft"
                            }`}>
                              {session.status === "completed" ? "Done" : session.status === "tracking" ? "Tracking" : "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 rounded-card border border-dashed border-white/5 bg-[#0f1524]/20">
                <p className="text-xs text-text-muted italic">
                  No active schedules or task logs for this day.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pop up form modal */}
      {isModalOpen && (
        <ShiftFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          selectedDate={selectedDateStr}
        />
      )}
    </div>
  );
}
