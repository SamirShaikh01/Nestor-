"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Clock3,
  Search,
  Plus,
  Ticket as TicketIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Activity,
  TrendingUp,
  Users,
  BookOpen,
  ClipboardList,
  ShieldCheck,
  Layers,
  Hourglass,
  ListTodo,
  Play,
  Pause,
  Square,
  FileText,
  Pin,
  CalendarDays,
  Bookmark,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
} from "recharts";
import { useNestor } from "@/src/shared/context/nestor-context";
import { isSupabaseConfigured } from "@/src/shared/lib/supabase";
import { getCategoryColorBadge, getShiftBadgeClasses } from "@/src/shared/lib/theme-utils";
import { TaskForm } from "../../task/components/task-form";
import { TicketForm } from "../../ticket/components/ticket-form";
import type { Task } from "@/src/features/task/types";
import type { Ticket, TicketPriority } from "@/src/features/ticket/types";




import { type ViewId } from "@/src/shared/components/layout/app-shell";

interface DashboardOverviewProps {
  onViewChange?: (view: ViewId) => void;
  onSelectTask?: (id: number | null) => void;
  onSelectTicket?: (id: string | null) => void;
  onSelectOemCase?: (id: string | null) => void;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return true;
  
  let qIdx = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      if (qIdx === q.length) return true;
    }
  }
  return false;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

export function DashboardOverview({
  onViewChange,
  onSelectTask,
  onSelectTicket,
  onSelectOemCase,
}: DashboardOverviewProps) {
  const {
    tasks,
    tickets,
    addTask,
    addTicket,
    username,
    activeTimers,
    startTimer,
    pauseTimer,
    stopTimer,
    shiftAssignments,
    products,
    categories,
    oemCases,
    employeeId,
  } = useNestor();

  // SSR hydration safety
  const [isMounted, setIsMounted] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayUsername = isMounted ? username : "Boss";

  // Filter, Search Dialog, Quick Actions states
  const [globalFilter, setGlobalFilter] = useState<"Today" | "This Week" | "This Month" | "Custom">("This Week");
  const [customStart, setCustomStart] = useState("2026-07-01");
  const [customEnd, setCustomEnd] = useState("2026-07-14");
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isTicketFormOpen, setIsTicketFormOpen] = useState(false);

  // Quick Notes persistence in localStorage — scoped per user (by employeeId)
  // so one account's notes never show up for a different account signed into
  // the same browser. When Supabase is configured, employeeId loads
  // asynchronously after the profile fetch, so the initial value can't be
  // read synchronously at mount (there's no user to scope it to yet) — it's
  // loaded once employeeId resolves instead.
  const [quickNote, setQuickNote] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSupabaseConfigured && !employeeId) return; // still waiting on the profile fetch
    const key = `nestor_dashboard_notes_${employeeId || "local"}`;
    setQuickNote(localStorage.getItem(key) || "");
  }, [employeeId]);

  const handleNoteChange = (val: string) => {
    setQuickNote(val);
    if (typeof window === "undefined") return;
    if (isSupabaseConfigured && !employeeId) return; // don't write under a not-yet-known scope
    localStorage.setItem(`nestor_dashboard_notes_${employeeId || "local"}`, val);
  };

  // Date constants
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const weekRange = useMemo(() => {
    const d = new Date();
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;

    return { startStr, endStr };
  }, []);

  const todayFormattedDate = useMemo(() => {
    const d = new Date();
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${weekdays[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  // Filter check
  const filterByRange = useCallback((dateStr: string) => {
    if (globalFilter === "Today") {
      return dateStr === todayStr;
    }
    if (globalFilter === "This Week") {
      return dateStr >= weekRange.startStr && dateStr <= weekRange.endStr;
    }
    if (globalFilter === "This Month") {
      return dateStr.startsWith(todayStr.substring(0, 7));
    }
    if (globalFilter === "Custom") {
      return dateStr >= customStart && dateStr <= customEnd;
    }
    return true;
  }, [globalFilter, todayStr, weekRange, customStart, customEnd]);

  const filteredTasks = useMemo(() => tasks.filter((t) => filterByRange(t.date)), [tasks, filterByRange]);
  const filteredTickets = useMemo(() => tickets.filter((t) => filterByRange(t.date)), [tickets, filterByRange]);

  // Statistics
  const stats = useMemo(() => {
    const totalT = filteredTickets.length;
    const openT = filteredTickets.filter((t) => t.status === "Open").length;
    const closedT = filteredTickets.filter((t) => t.status === "Closed" || t.status === "Resolved").length;
    const awaitingT = filteredTickets.filter((t) => t.status === "Awaiting Information").length;
    const inProgressT = filteredTickets.filter((t) => t.status === "In Progress").length;

    const totalK = filteredTasks.length;
    const completedK = filteredTasks.filter((t) => t.status === "completed").length;
    const pendingK = filteredTasks.filter((t) => t.status === "pending").length;
    const completionRate = totalK > 0 ? Math.round((completedK / totalK) * 100) : 0;
    const totalHours = (filteredTasks.reduce((sum, t) => sum + t.durationMinutes, 0) / 60).toFixed(1);

    return {
      totalT,
      openT,
      closedT,
      awaitingT,
      inProgressT,
      totalK,
      completedK,
      pendingK,
      completionRate,
      totalHours,
    };
  }, [filteredTasks, filteredTickets]);

  const dateRangeLabel = useMemo(() => {
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDate = (dateStr: string) => {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const year = parts[0];
      const month = monthsShort[parseInt(parts[1], 10) - 1];
      const day = parseInt(parts[2], 10);
      return `${month} ${day}, ${year}`;
    };

    if (globalFilter === "Today") {
      return formatDate(todayStr);
    }
    if (globalFilter === "This Week") {
      return `${formatDate(weekRange.startStr)} — ${formatDate(weekRange.endStr)}`;
    }
    if (globalFilter === "This Month") {
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const startStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const endStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return `${formatDate(startStr)} — ${formatDate(endStr)}`;
    }
    if (globalFilter === "Custom") {
      return `${formatDate(customStart)} — ${formatDate(customEnd)}`;
    }
    return "";
  }, [globalFilter, todayStr, weekRange, customStart, customEnd]);

  const todayStats = useMemo(() => {
    const todayTasks = tasks.filter((t) => t.date === todayStr);
    const todayTickets = tickets.filter((t) => t.date === todayStr);
    const total = todayTasks.length + todayTickets.length;
    
    const completedTasks = todayTasks.filter((t) => t.status === "completed").length;
    const completedTickets = todayTickets.filter((t) => t.status === "Closed" || t.status === "Resolved").length;
    const completed = completedTasks + completedTickets;
    
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [tasks, tickets, todayStr]);

  const activityChartData = useMemo(() => {
    const dates: string[] = [];
    const dateMap: Record<string, { date: string; displayDate: string; tasks: number; tickets: number }> = {};
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const formatDisplayDate = (dStr: string) => {
      const parts = dStr.split("-");
      if (parts.length !== 3) return dStr;
      const mIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${monthsShort[mIdx]} ${day}`;
    };

    // Gather all dates from filtered dataset
    const allDates = new Set<string>();
    filteredTasks.forEach(t => allDates.add(t.date));
    filteredTickets.forEach(t => allDates.add(t.date));

    const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b));

    // Fallback: If empty, let's pre-populate with last 7 days
    if (sortedDates.length === 0) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        sortedDates.push(dStr);
      }
    }

    sortedDates.forEach(date => {
      dateMap[date] = {
        date,
        displayDate: formatDisplayDate(date),
        tasks: 0,
        tickets: 0
      };
    });

    filteredTasks.forEach(t => {
      if (dateMap[t.date]) {
        dateMap[t.date].tasks++;
      }
    });

    filteredTickets.forEach(t => {
      if (dateMap[t.date]) {
        dateMap[t.date].tickets++;
      }
    });

    return sortedDates.map(date => dateMap[date]);
  }, [filteredTasks, filteredTickets]);

  // Daily Briefing narrative
  const dailyBriefingText = useMemo(() => {
    const pendingCount = stats.pendingK;
    const attentionTickets = stats.openT + stats.inProgressT;
    const hrs = stats.totalHours;

    let greeting = `Good day, ${displayUsername}. `;
    if (globalFilter === "Today") {
      greeting += `For today, you have ${pendingCount} pending tasks and ${attentionTickets} active tickets to work through. `;
    } else {
      greeting += `This week, you've logged ${hrs} hours, with ${pendingCount} pending tasks and ${attentionTickets} tickets awaiting action. `;
    }

    if (attentionTickets > 2) {
      greeting += "Ticket queues are running high. Focus on resolving critical items early.";
    } else {
      greeting += "Your workload looks steady and balanced today.";
    }
    return greeting;
  }, [stats, displayUsername, globalFilter]);

  // Tomorrow's shift resolution
  const tomorrowShift = useMemo(() => {
    return shiftAssignments[tomorrowStr] || null;
  }, [shiftAssignments, tomorrowStr]);

  // Active Task for "Continue Work" panel
  const activeTask = useMemo(() => {
    const timerKeys = Object.keys(activeTimers);
    if (timerKeys.length > 0) {
      const matched = tasks.find((t) => t.id === Number(timerKeys[0]));
      if (matched) return { task: matched, isActive: true };
    }
    const lastIncomplete = tasks
      .filter((t) => t.status !== "completed")
      .sort((a, b) => b.id - a.id)[0];
    if (lastIncomplete) return { task: lastIncomplete, isActive: false };
    return null;
  }, [activeTimers, tasks]);

  // Today's Focus List
  const todayFocusItems = useMemo(() => {
    const list: Array<
      | { type: "ticket"; id: string; title: string; status: string; priority: string; category: string }
      | { type: "task"; id: number; title: string; status: string; priority: string; category: string }
    > = [];

    filteredTickets.filter((t) => t.status !== "Closed" && t.status !== "Resolved").forEach((t) => {
      list.push({
        type: "ticket",
        id: t.id,
        title: t.subject,
        status: t.status,
        priority: t.priority,
        category: t.product || "Ticket",
      });
    });

    filteredTasks.filter((t) => t.status !== "completed").forEach((t) => {
      list.push({
        type: "task",
        id: t.id,
        title: t.title,
        status: t.status,
        priority: "N/A",
        category: t.category,
      });
    });

    return list.slice(0, 4);
  }, [filteredTasks, filteredTickets]);

  // Work Category Cards metrics (Task-only categories)
  const workCategoriesData = useMemo(() => {
    // 1. Group tasks by category
    const categoriesMap: Record<string, { count: number; hours: number }> = {};
    filteredTasks.forEach((t) => {
      const cat = t.category || "Operations";
      if (!categoriesMap[cat]) {
        categoriesMap[cat] = { count: 0, hours: 0 };
      }
      categoriesMap[cat].count++;
      categoriesMap[cat].hours += t.durationMinutes / 60;
    });

    // 2. Map to display config
    const categoryConfigs: Record<string, { icon: LucideIcon; color: string }> = {
      meeting: { icon: Users, color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
      learning: { icon: BookOpen, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
      operations: { icon: ClipboardList, color: "text-danger bg-danger/10 border-danger/20" },
      personal: { icon: BookOpen, color: "text-pink-500 bg-pink-500/10 border-pink-500/20" },
      research: { icon: ClipboardList, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
      documentation: { icon: FileText, color: "text-success bg-success/10 border-success/20" },
      automation: { icon: FileText, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
      "health check": { icon: ShieldCheck, color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
    };

    // 3. Initialize list with all active categories from settings
    const activeCategoryNames = new Set(categories.map((c) => c.toLowerCase().trim()));
    
    const list = categories.map((catName) => {
      const key = catName.toLowerCase().trim();
      const data = categoriesMap[catName] || { count: 0, hours: 0 };
      const config = categoryConfigs[key] || { icon: ClipboardList, color: "text-text-soft bg-white/5 border-white/10" };
      return {
        name: catName,
        count: data.count,
        hours: data.hours.toFixed(1),
        icon: config.icon,
        color: config.color,
      };
    });

    // Add any category from tasks that might not be in the active settings list (historical)
    Object.entries(categoriesMap).forEach(([catName, data]) => {
      const key = catName.toLowerCase().trim();
      if (!activeCategoryNames.has(key)) {
        const config = categoryConfigs[key] || { icon: ClipboardList, color: "text-text-soft bg-white/5 border-white/10" };
        list.push({
          name: catName,
          count: data.count,
          hours: data.hours.toFixed(1),
          icon: config.icon,
          color: config.color,
        });
      }
    });

    // Sort by count descending, then by name alphabetically
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return list.slice(0, 5);
  }, [filteredTasks, categories]);

  // Productivity Heatmap data per day of week (as attached in image)
  const heatmapData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const dailyHours = [0, 0, 0, 0, 0, 0, 0];

    // Filter tasks logged within the current week range
    const currentWeekTasks = tasks.filter((t) => {
      return t.date >= weekRange.startStr && t.date <= weekRange.endStr;
    });

    currentWeekTasks.forEach((t) => {
      const parts = t.date.split("-");
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        const dateObj = new Date(year, month - 1, day);
        const dayIndex = dateObj.getDay(); // 0 is Sun, 1 is Mon, ...
        const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        if (mappedIndex >= 0 && mappedIndex < 7) {
          dailyHours[mappedIndex] += t.durationMinutes / 60;
        }
      }
    });

    return days.map((dayName, idx) => {
      const hours = dailyHours[idx];
      // Calculate block contributions: e.g. 1 block per 2 hours worked. Max 5 blocks.
      const blocksCount = hours === 0 ? 0 : Math.min(5, Math.ceil(hours / 2));
      return {
        day: dayName,
        hours: hours.toFixed(1),
        blocks: blocksCount,
      };
    });
  }, [tasks, weekRange]);

  // Ticket Count by Product Name for ALL products
  const productTicketCounts = useMemo(() => {
    // 1. Group tickets by product name
    const counts: Record<string, number> = {};
    filteredTickets.forEach((t) => {
      const prod = t.product || "Unassigned";
      counts[prod] = (counts[prod] || 0) + 1;
    });

    // 2. Ensure ALL products from the settings/context are included (even if 0 counts)
    const list = products.map((prod) => ({
      name: prod,
      count: counts[prod] || 0,
    }));

    // Add "Unassigned" count if there are tickets with no valid product matching active list
    const unassignedCount = filteredTickets.filter((t) => !t.product || !products.includes(t.product)).length;
    if (unassignedCount > 0) {
      list.push({
        name: "Unassigned",
        count: unassignedCount,
      });
    }

    // Sort by count descending, then by name alphabetically
    return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [filteredTickets, products]);

  // Fuzzy Search matches
  const matchedResults = useMemo(() => {
    if (!searchQuery.trim()) return { tasks: [], tickets: [] };
    const query = searchQuery.trim();

    const matchedTasks = tasks.filter((t) => {
      return (
        fuzzyMatch(t.title, query) ||
        fuzzyMatch(t.description || "", query) ||
        fuzzyMatch(t.category || "", query) ||
        fuzzyMatch(t.notes || "", query) ||
        t.tags.some((tag) => fuzzyMatch(tag, query))
      );
    });

    const matchedTickets = tickets.filter((t) => {
      return (
        fuzzyMatch(t.id, query) ||
        fuzzyMatch(t.subject, query) ||
        fuzzyMatch(t.customerName || "", query) ||
        fuzzyMatch(t.customerId || "", query) ||
        fuzzyMatch(t.product || "", query) ||
        fuzzyMatch(t.raisedBy || "", query) ||
        fuzzyMatch(t.details || "", query) ||
        fuzzyMatch(t.myWork || "", query) ||
        fuzzyMatch(t.myNote || "", query) ||
        t.comments.some((c) => fuzzyMatch(c.content, query) || fuzzyMatch(c.author, query))
      );
    }).map((t) => ({ ...t, resultType: "ticket", displayId: t.id }));

    const matchedOem = oemCases.filter((c) => {
      return (
        fuzzyMatch(c.oemCaseId || "", query) ||
        fuzzyMatch(c.internalTicketId || "", query) ||
        fuzzyMatch(c.title || "", query) ||
        fuzzyMatch(c.clientName || "", query) ||
        fuzzyMatch(c.productName || "", query) ||
        fuzzyMatch(c.description || "", query) ||
        fuzzyMatch(c.notes || "", query)
      );
    }).map((c) => ({
      id: c.id,
      subject: c.title,
      displayId: c.oemCaseId || c.internalTicketId || c.id,
      resultType: "oem",
    }));

    return { tasks: matchedTasks, tickets: [...matchedTickets, ...matchedOem] };
  }, [tasks, tickets, oemCases, searchQuery]);

  // Unified activity timeline feed (recent logs)
  const timelineActivities = useMemo(() => {
    const list: Array<{
      id: string | number;
      type: "ticket" | "task";
      activity: string;
      title: string;
      timestamp: string;
      icon: LucideIcon;
      color: string;
    }> = [];

    filteredTasks.forEach((t) => {
      if (t.status === "completed") {
        list.push({
          id: t.id,
          type: "task",
          activity: "Completed Task",
          title: t.title,
          timestamp: t.date,
          icon: CheckCircle2,
          color: "text-success bg-success/10 border-success/20",
        });
      } else if (t.category === "Meeting") {
        list.push({
          id: t.id,
          type: "task",
          activity: "Meeting Logged",
          title: t.title,
          timestamp: t.date,
          icon: Users,
          color: "text-accent-purple bg-accent-purple/10 border-accent-purple/20",
        });
      }
    });

    filteredTickets.forEach((t) => {
      if (t.status === "Closed" || t.status === "Resolved") {
        list.push({
          id: t.id,
          type: "ticket",
          activity: "Resolved Ticket",
          title: t.subject,
          timestamp: t.date,
          icon: ShieldCheck,
          color: "text-success bg-success/10 border-success/20",
        });
      } else {
        list.push({
          id: t.id,
          type: "ticket",
          activity: "Logged Ticket",
          title: t.subject,
          timestamp: t.date,
          icon: AlertCircle,
          color: "text-danger bg-danger/10 border-danger/20",
        });
      }
    });

    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
  }, [filteredTasks, filteredTickets]);

  // Priority Chart distribution (Radial Bar concentric setup)
  const priorityChartData = useMemo(() => {
    const counts: Record<TicketPriority, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
    filteredTickets.forEach((t) => {
      if (t.priority in counts) counts[t.priority]++;
    });

    const colors = {
      P1: "url(#gradPink)",
      P2: "url(#gradOrange)",
      P3: "url(#gradPurple)",
      P4: "url(#gradGreen)",
      P5: "url(#gradCyan)",
      P6: "url(#gradPurple)",
    };

    const legendColors = {
      P1: "#ec4899", // Pink
      P2: "#f97316", // Orange
      P3: "#a855f7", // Purple
      P4: "#10b981", // Green
      P5: "#06b6d4", // Cyan
      P6: "#64748b", // Slate
    };

    // concentric innermost (P4) to outermost (P1)
    const priorities: TicketPriority[] = ["P4", "P3", "P2", "P1"];
    return priorities
      .map((p) => ({
        name: p,
        value: counts[p],
        fill: colors[p] || "url(#gradPurple)",
        legendColor: legendColors[p] || "#a855f7",
      }))
      .filter((d) => d.value > 0);
  }, [filteredTickets]);

  // Weekly ticket trend calculator
  const ticketsByWeekData = useMemo(() => {
    // Group tickets by week starting on Sunday
    const weekCounts: Record<string, number> = {};
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Seed the last 4 weeks leading up to today so it looks complete even if no tickets are logged
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - (i * 7) - now.getDay()); // start of week i weeks ago (Sunday)
      const label = `${d.getDate()} ${monthsShort[d.getMonth()]}`;
      weekCounts[label] = 0;
    }
    
    filteredTickets.forEach((t) => {
      const parts = t.date.split("-");
      if (parts.length === 3) {
        const ticketDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        // Get start of week (Sunday)
        const startOfWeek = new Date(ticketDate);
        startOfWeek.setDate(ticketDate.getDate() - ticketDate.getDay());
        const label = `${startOfWeek.getDate()} ${monthsShort[startOfWeek.getMonth()]}`;
        
        // Only increment if it matches one of our pre-populated slots (to prevent overflow)
        if (label in weekCounts) {
          weekCounts[label]++;
        }
      }
    });

    return Object.entries(weekCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        // Natural sort by calendar chronological order
        return a.name.localeCompare(b.name);
      });
  }, [filteredTickets]);

  // Lists lookup
  const pendingTickets = useMemo(() => {
    return tickets
      .filter((t) => t.status !== "Closed" && t.status !== "Resolved")
      .slice(0, 5);
  }, [tickets]);

  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "completed")
      .slice(0, 5);
  }, [tasks]);

  const rangeMeetings = useMemo(() => {
    return filteredTasks.filter((t) => t.category === "Meeting").slice(0, 5);
  }, [filteredTasks]);



  // Handlers for switching views & highlighting
  const handleTaskClick = (id: number) => {
    setIsSearchOpen(false);
    onSelectTask?.(id);
    onViewChange?.("tasks");
  };

  const handleTicketClick = (id: string) => {
    setIsSearchOpen(false);
    onSelectTicket?.(id);
    onViewChange?.("tickets");
  };

  const handleOemClick = (id: string) => {
    setIsSearchOpen(false);
    onSelectOemCase?.(id);
    onViewChange?.("oem-cases");
  };

  const handleCreateTask = async (data: Omit<Task, "id">) => {
    await addTask(data);
    setIsTaskFormOpen(false);
  };

  const handleCreateTicket = async (data: Ticket) => {
    await addTicket(data);
    setIsTicketFormOpen(false);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Row 1: Greeting + Search + Quick Actions */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-6"
      >
        <div>
          <h1 suppressHydrationWarning className="text-3xl font-extrabold tracking-tight text-text-primary">
            Welcome back, {displayUsername} 👋
          </h1>
          <p suppressHydrationWarning className="mt-1 text-sm text-text-muted font-medium">{isMounted ? todayFormattedDate : ""}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Pop-up Search Trigger Icon */}
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setIsSearchOpen(true);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-btn bg-gradient-to-r from-accent-cyan to-accent-blue text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer"
            title="Search tasks & tickets"
          >
            <Search size={16} strokeWidth={2.5} />
          </button>

          {/* Quick Actions */}
          <button
            type="button"
            onClick={() => setIsTaskFormOpen(true)}
            className="flex items-center gap-1.5 rounded-btn bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#d946ef] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            <Plus size={14} strokeWidth={2.5} /> Task
          </button>
          <button
            type="button"
            onClick={() => setIsTicketFormOpen(true)}
            className="flex items-center gap-1.5 rounded-btn bg-gradient-to-r from-[#ec4899] via-[#f43f5e] to-[#e11d48] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(236,72,153,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            <Plus size={14} strokeWidth={2.5} /> Ticket
          </button>

          {/* Custom React Global Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 rounded-btn border px-5 py-2.5 text-xs font-bold shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider select-none dark:from-[#1e293b] dark:to-[#0f172a] dark:bg-gradient-to-r dark:border-white/10 dark:text-white dark:hover:from-[#334155] dark:hover:to-[#475569]"
            >
              <CalendarDays size={14} className="text-accent-cyan flex-shrink-0" />
              <span>{globalFilter === "Custom" ? "Custom Range" : globalFilter}</span>
              <ChevronDown size={12} className={`text-white/70 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  {/* Invisible backdrop to capture clicks away */}
                  <div
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  {/* Floating glassmorphism menu */}
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-48 rounded-[16px] border p-1.5 z-20 overflow-hidden flex flex-col gap-0.5 dark:border-white/8 dark:bg-card-bg/95 dark:backdrop-blur-[12px] dark:shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
                  >
                    {[
                      { value: "Today", label: "Today" },
                      { value: "This Week", label: "This Week" },
                      { value: "This Month", label: "This Month" },
                      { value: "Custom", label: "Custom Range" },
                    ].map((opt) => {
                      const isSelected = globalFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setGlobalFilter(opt.value as typeof globalFilter);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-[10px] transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-accent-cyan/15 text-accent-cyan"
                              : "text-text-muted hover:bg-white/5 hover:text-text-primary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Inline Date Filter Custom Fields */}
      {globalFilter === "Custom" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-3 sm:grid-cols-2 rounded-card border border-border bg-card-bg p-5 shadow-soft backdrop-blur-[12px]"
        >
          <label className="text-xs uppercase tracking-wider font-bold text-text-soft">
            Start Date
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="mt-2 w-full rounded-input border border-border bg-white/5 px-3.5 py-2 text-sm text-text-primary outline-none focus:border-accent-cyan transition-all"
            />
          </label>
          <label className="text-xs uppercase tracking-wider font-bold text-text-soft">
            End Date
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="mt-2 w-full rounded-input border border-border bg-white/5 px-3.5 py-2 text-sm text-text-primary outline-none focus:border-accent-cyan transition-all"
            />
          </label>
        </motion.div>
      )}

      {/* Pop-up Search Modal Dialog */}
      <AnimatePresence>
        {isSearchOpen && (
          <div
            onClick={() => setIsSearchOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070f]/20 backdrop-blur-[4px] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl rounded-card border border-white/10 bg-sidebar-bg p-6 shadow-soft backdrop-blur-[24px]"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-4 top-4 rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <h2 className="text-lg font-semibold tracking-tight text-text-primary mb-4 flex items-center gap-2">
                <Search size={18} className="text-accent-cyan" /> Search Logs
              </h2>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Fuzzy search tasks, tickets, comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 pl-4 pr-10 py-3 text-sm text-text-primary outline-none focus:border-accent-cyan focus:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all"
                  autoFocus
                />
              </div>

              {/* Search results conditional layout */}
              {searchQuery.trim() !== "" && (
                <div className="mt-6">
                  {matchedResults.tasks.length === 0 && matchedResults.tickets.length === 0 ? (
                    <div className="text-center py-8 text-sm text-text-muted italic">
                      No results matched your search query.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`grid gap-6 max-h-[350px] overflow-y-auto pr-1 ${
                        matchedResults.tasks.length > 0 && matchedResults.tickets.length > 0
                          ? "md:grid-cols-2"
                          : "grid-cols-1"
                      }`}>
                        {/* Matched Tasks column */}
                        {matchedResults.tasks.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold text-accent-purple uppercase tracking-wider mb-3">
                              Tasks ({matchedResults.tasks.length})
                            </h3>
                            <div className="space-y-2">
                              {matchedResults.tasks.map((t) => (
                                <div
                                  key={t.id}
                                  onDoubleClick={() => handleTaskClick(t.id)}
                                  className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-purple/40 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3 flex items-start justify-between gap-2 cursor-pointer transition-all select-none"
                                  title="Double click to open task"
                                >
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-text-primary block truncate">{t.title}</span>
                                    <span className="text-[10px] text-text-muted mt-0.5 block">{t.category}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Matched Tickets column */}
                        {matchedResults.tickets.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold text-accent-cyan uppercase tracking-wider mb-3">
                              Tickets ({matchedResults.tickets.length})
                            </h3>
                            <div className="space-y-2">
                              {matchedResults.tickets.map((t: any) => (
                                <div
                                  key={`${t.resultType}-${t.id}`}
                                  onDoubleClick={() => t.resultType === "oem" ? handleOemClick(t.id) : handleTicketClick(t.id)}
                                  className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-cyan/40 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3 flex items-start justify-between gap-2 cursor-pointer transition-all select-none"
                                  title={`Double click to open ${t.resultType === "oem" ? "OEM Case" : "ticket"}`}
                                >
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-text-primary block truncate">{t.subject}</span>
                                    <span className="text-[10px] text-accent-cyan mt-0.5 block font-bold">
                                      {t.resultType === "oem" ? `${t.displayId} (OEM)` : t.displayId}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-text-soft text-right font-medium italic select-none">
                        💡 Double-click any task or ticket to open details.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Row 2: Daily Briefing */}
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -4, scale: 1.01 }}
        className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow relative overflow-hidden backdrop-blur-[12px] transition-all duration-300"
      >
        <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-32 h-32 bg-accent-cyan/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-soft mb-1.5 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-accent-cyan" /> Daily Briefing
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              {dailyBriefingText}
            </p>
          </div>

          {/* Tomorrow's Shift info */}
          <div className="rounded-input border border-border bg-white/5 p-3 min-w-[200px] flex-shrink-0 backdrop-blur-[6px]">
            <span className="text-[10px] font-bold text-text-soft uppercase block tracking-wider">Tomorrow&apos;s Shift</span>
            {!isMounted ? (
              <p className="text-xs font-semibold text-text-muted mt-1.5 italic">Loading...</p>
            ) : tomorrowShift ? (
              <div className="mt-1.5">
                <span className={`inline-block rounded-badge px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getShiftBadgeClasses(tomorrowShift.shiftName)}`}>
                  {tomorrowShift.shiftName}
                </span>
                <p className="text-[10px] text-text-muted mt-1 font-semibold">Timings: {tomorrowShift.inTime} - {tomorrowShift.outTime}</p>
                {tomorrowShift.note && (
                  <p className="text-[9px] italic text-text-soft mt-1 border-t border-border pt-1 truncate" title={tomorrowShift.note}>
                    Note: {tomorrowShift.note}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold text-text-muted mt-1.5 italic">No shift assigned yet.</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Row 4: Work Category Cards (top 5 category cards) */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 grid-cols-2 md:grid-cols-5"
      >
        {!isMounted ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[20px] border border-transparent dark:border-white/5 bg-card-bg p-4 h-[110px] animate-pulse flex flex-col justify-between" />
          ))
        ) : (
          workCategoriesData.map((c, idx) => {
            const Icon = c.icon;
            return (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                key={idx}
                className="rounded-[20px] border border-transparent dark:border-white/5 bg-card-bg p-4 h-[110px] shadow-soft hover:shadow-glow transition-all duration-300 backdrop-blur-[12px] flex flex-col justify-between cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${c.color} shadow-sm`}>
                  <Icon size={16} />
                </div>
                <div className="mt-auto text-right">
                  <span className="text-2xl font-bold tracking-tight text-text-primary block leading-none">{c.count}</span>
                  <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide mt-1 block truncate" title={c.name}>{c.name}</span>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Row 5: Statistics Cards (Ticket Overview stats) */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 grid-cols-2 md:grid-cols-5"
      >
        {[
          { title: "Total Tickets", val: stats.totalT, color: "bg-accent-purple/10 text-accent-purple border-accent-purple/20", icon: TicketIcon },
          { title: "Open Tickets", val: stats.openT, color: "bg-danger/10 text-danger border-danger/20", icon: AlertCircle },
          { title: "In Progress", val: stats.inProgressT, color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock3 },
          { title: "On Hold", val: stats.awaitingT, color: "bg-warning/10 text-warning border-warning/20", icon: HelpCirclePlaceholder },
          { title: "Closed/Resolved", val: stats.closedT, color: "bg-success/10 text-success border-success/20", icon: ShieldCheck },
        ].map((c, i) => {
          const IconComponent = c.icon;
          return (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -6, scale: 1.02 }}
              key={i}
              className="rounded-[20px] border border-transparent dark:border-white/5 bg-card-bg p-4 h-[110px] shadow-soft hover:shadow-glow transition-all duration-300 backdrop-blur-[12px] flex flex-col justify-between cursor-pointer"
            >
              <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${c.color} shadow-sm`}>
                <IconComponent size={16} />
              </div>
              <div className="mt-auto text-right">
                <span className="text-2xl font-bold tracking-tight text-text-primary block leading-none">{c.val}</span>
                <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide mt-1 block truncate" title={c.title}>{c.title}</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Row 3: Continue Work | Today's Focus */}
      <motion.div
        variants={itemVariants}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        {/* Continue Work */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow flex flex-col justify-between backdrop-blur-[12px] transition-all duration-300"
        >
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-3">
              <Hourglass size={16} className="text-accent-purple" /> Continue Work
            </h3>
            {activeTask ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-badge uppercase tracking-wider ${getCategoryColorBadge(activeTask.task.category)}`}>
                      {activeTask.task.category}
                    </span>
                    <h4 className="text-base font-bold text-text-primary leading-tight">{activeTask.task.title}</h4>
                  </div>
                  <p className="mt-2 text-xs text-text-muted leading-relaxed line-clamp-2">
                    {activeTask.task.description || "No description logged."}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded border border-border bg-[#0f172a]/4 dark:bg-white/5 px-2.5 py-1.5 text-xs text-text-soft flex items-center gap-1.5">
                      <Clock3 size={13} className="text-accent-cyan" />
                      <span>Duration: {formatMinutes(activeTask.task.durationMinutes)}</span>
                    </div>
                    {activeTask.isActive && (
                      <span className="text-[10px] font-bold uppercase text-danger flex items-center gap-1 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Tracking session
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeTask.isActive ? (
                      <button
                        onClick={() => pauseTimer(activeTask.task.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-border text-warning transition-all cursor-pointer hover:scale-105"
                        title="Pause timer"
                      >
                        <Pause size={14} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startTimer(activeTask.task.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-purple hover:bg-accent-purple/80 text-white transition-all cursor-pointer hover:scale-105 shadow-glow"
                        title="Resume timer"
                      >
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                      </button>
                    )}
                    <button
                      onClick={() => stopTimer(activeTask.task.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-border text-success transition-all cursor-pointer hover:scale-105"
                      title="Mark task completed"
                    >
                      <Square size={12} fill="currentColor" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-input border border-dashed border-border bg-[#0f172a]/4 dark:bg-white/5 p-8 text-center text-xs text-text-muted">
                No active task timers. Log or create a task to begin tracking.
              </div>
            )}
          </div>
        </motion.div>

        {/* Today's Focus */}
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow backdrop-blur-[12px] transition-all duration-300 flex flex-col justify-between"
        >
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-3">
              <Layers size={16} className="text-accent-cyan" /> Today&apos;s Focus
            </h3>
            <div className="space-y-3">
              {todayFocusItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => (item.type === "task" ? handleTaskClick(item.id as number) : handleTicketClick(item.id as string))}
                  className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-cyan/20 p-3 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-[#0f172a]/8 dark:hover:bg-white/10"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-badge uppercase ${
                        item.type === "task" ? "bg-accent-purple/10 text-accent-purple border border-accent-purple/20" : "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                      }`}>
                        {item.type === "task" ? "Task" : item.id}
                      </span>
                      <span className="text-xs font-semibold text-text-primary truncate block">{item.title}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[8px] font-bold rounded-badge px-1.5 uppercase ${
                      item.status === "completed" || item.status === "Resolved" || item.status === "Closed"
                        ? "bg-success/15 text-success border border-success/25"
                        : "bg-warning/15 text-warning border border-warning/25"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
              {todayFocusItems.length === 0 && (
                <div className="text-center text-xs text-text-muted py-6 italic">No pending focus items.</div>
              )}
            </div>
          </div>

          {/* Radial progress ring section */}
          {todayStats.total > 0 && (
            <div className="border-t border-border pt-4 mt-4 flex items-center gap-5 justify-center sm:justify-start">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    className="stroke-accent-purple"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 - (todayStats.percent / 100) * 2 * Math.PI * 32}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-sm font-extrabold text-text-primary">{todayStats.percent}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-text-primary">Today's Progress</p>
                <p className="text-[10px] text-text-soft mt-0.5 leading-relaxed font-semibold">
                  {todayStats.completed} of {todayStats.total} work items completed today
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Row 6: Activity Timeline | Tickets by Product */}
      <motion.div
        variants={itemVariants}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        {/* Activity Timeline */}
        <div className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow backdrop-blur-[12px] hover:shadow-lg transition-all duration-300">
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-3">
            <Activity size={16} className="text-accent-purple" /> Activity Timeline
          </h3>
          <div className="relative border-l border-dashed border-border ml-3.5 pl-6 space-y-5 max-h-[300px] overflow-y-auto pr-1">
            {timelineActivities.map((act, idx) => {
              const Icon = act.icon;
              return (
                <div key={idx} className="relative flex items-start">
                  <div className={`absolute -left-[34px] top-1.5 h-5 w-5 rounded-full border flex items-center justify-center z-10 ${act.color}`}>
                    <Icon size={9} />
                  </div>
                  <div
                    onClick={() => (act.type === "task" ? handleTaskClick(act.id as number) : handleTicketClick(act.id as string))}
                    className="flex-1 rounded-input border border-border hover:border-accent-purple/35 bg-[#0f172a]/4 dark:bg-white/5 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3.5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-bold text-text-soft uppercase tracking-wider">{act.activity}</span>
                      <span className="text-[10px] text-text-muted font-medium">{act.timestamp}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-text-primary line-clamp-1">{act.title}</p>
                  </div>
                </div>
              );
            })}
            {timelineActivities.length === 0 && (
              <div className="text-center text-xs text-text-muted py-6 italic">No recent log activities.</div>
            )}
          </div>
        </div>

        {/* Tickets by Product Cards */}
        <div className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow flex flex-col justify-between backdrop-blur-[12px] hover:shadow-lg transition-all duration-300">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-3">
              <TicketIcon size={16} className="text-accent-cyan" /> Tickets by Product
            </h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 max-h-[300px] overflow-y-auto pr-1">
              {!isMounted ? (
                <div className="text-center text-xs text-text-muted py-6 italic col-span-2">Loading products...</div>
              ) : (
                <>
                  {productTicketCounts.map((prod, idx) => (
                    <div
                      key={idx}
                      className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 p-3 flex items-center justify-between gap-3 hover:border-accent-cyan/20 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-text-primary block truncate font-medium" title={prod.name}>
                          {prod.name}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold rounded-badge px-2 py-0.5 ${
                        prod.count > 0 ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25" : "bg-[#0f172a]/4 dark:bg-white/5 text-text-soft border border-border"
                      }`}>
                        {prod.count} {prod.count === 1 ? "Ticket" : "Tickets"}
                      </span>
                    </div>
                  ))}
                  {productTicketCounts.length === 0 && (
                    <div className="text-center text-xs text-text-muted py-6 italic col-span-2">No products configured.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Row 7: Analytics & Charts Visuals */}
      <motion.div
        variants={itemVariants}
        className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow space-y-6 backdrop-blur-[12px] hover:shadow-lg transition-all duration-300"
      >
        {/* Hidden SVG for Recharts Gradient Definitions */}
        <svg className="absolute w-0 h-0" width="0" height="0">
          <defs>
            <linearGradient id="gradPurple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <linearGradient id="gradCyan" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <linearGradient id="gradOrange" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="gradGreen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="gradPink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
          </defs>
        </svg>

        <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary border-b border-border pb-3">
          Analytics & Shift Output
        </h3>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Recharts Priority Chart (Semi-Circle Pie Chart) */}
          <div className="rounded-card border border-transparent dark:border-white/5 bg-[#0f172a]/4 dark:bg-white/5 p-4 flex flex-col justify-between backdrop-blur-[6px] shadow-sm">
            <div>
              <h4 className="text-xs font-bold text-text-soft uppercase tracking-wider mb-2">Ticket Priority</h4>
              {priorityChartData.length > 0 ? (
                <div className="grid grid-cols-[0.45fr_0.55fr] gap-2 h-[180px]">
                  {/* Left Column: Total count + Legend */}
                  <div className="flex flex-col justify-between py-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-text-soft tracking-wider block">Total tickets</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xl font-bold tracking-tight text-text-primary">
                          {priorityChartData.reduce((sum, item) => sum + item.value, 0)}
                        </span>
                        <span className="text-xs text-success font-bold flex items-center">
                          <TrendingUp size={11} className="mr-0.5" />
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      {/* Priority details */}
                      {priorityChartData.slice().reverse().map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] font-semibold text-text-muted">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.legendColor }} />
                          <span className="truncate flex-1">{item.name}</span>
                          <span className="font-bold text-text-primary">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Semicircle Pie Chart */}
                  <div className="h-[180px] w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={priorityChartData}
                          cx="50%"
                          cy="75%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius="62%"
                          outerRadius="92%"
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {priorityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 21, 38, 0.95)",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                            color: "#f8fafc"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Inner Center display */}
                    <div className="absolute inset-x-0 bottom-3 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-extrabold tracking-tight text-text-primary leading-none">
                        {priorityChartData.reduce((sum, item) => sum + item.value, 0)}
                      </span>
                      <span className="text-[8px] uppercase font-bold text-text-soft tracking-wider mt-0.5">Tickets</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center">
                  <p className="text-xs text-text-muted italic">No ticket priority data.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recharts Tickets by Week Vertical Bar Chart */}
          <div className="rounded-card border border-transparent dark:border-white/5 bg-[#0f172a]/4 dark:bg-white/5 p-4 flex flex-col justify-between backdrop-blur-[6px] shadow-sm">
            <div>
              <h4 className="text-xs font-bold text-text-soft uppercase tracking-wider mb-2">Tickets by Week</h4>
              <div className="h-[180px] w-full flex items-center justify-center">
                {ticketsByWeekData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketsByWeekData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 21, 38, 0.95)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                          color: "#f8fafc"
                        }}
                      />
                      <Bar dataKey="value" fill="url(#gradCyan)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-text-muted italic">No weekly ticket data.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recharts Activity Trend Chart */}
          <div className="rounded-card border border-transparent dark:border-white/5 bg-[#0f172a]/4 dark:bg-white/5 p-4 flex flex-col justify-between backdrop-blur-[6px] shadow-sm">
            <div>
              <h4 className="text-xs font-bold text-text-soft uppercase tracking-wider mb-2">Activity Trend</h4>
              <div className="h-[180px] w-full flex items-center justify-center">
                {activityChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChartData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="displayDate" stroke="#64748b" fontSize={9} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(15, 21, 38, 0.95)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                          color: "#f8fafc"
                        }}
                      />
                      <Bar dataKey="tasks" name="Tasks" fill="url(#gradPurple)" radius={[6, 6, 0, 0]} animationDuration={1200} />
                      <Bar dataKey="tickets" name="Tickets" fill="url(#gradCyan)" radius={[6, 6, 0, 0]} animationDuration={1200} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-text-muted italic">No activity trend logs.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Row 8: Pending Tickets | Active Tasks */}
      <motion.div
        variants={itemVariants}
        className="grid gap-6 md:grid-cols-2"
      >
        {/* Pending Tickets */}
        <div className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow backdrop-blur-[12px] hover:shadow-lg transition-all duration-300">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TicketIcon size={13} className="text-danger" /> Pending Tickets
          </h3>
          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {pendingTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => handleTicketClick(t.id)}
                className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-cyan/20 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3 cursor-pointer transition-all flex items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-accent-cyan">{t.id}</span>
                    <span className="text-xs font-semibold text-text-primary truncate block max-w-[150px]">{t.subject}</span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">{t.customerName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[9px] font-bold rounded-badge px-1.5 uppercase ${
                    t.priority === "P1" || t.priority === "P2" ? "bg-danger/20 text-danger border border-danger/25" : "bg-[#0f172a]/4 dark:bg-white/5 text-text-soft border border-border"
                  }`}>
                    {t.priority}
                  </span>
                  <span className="text-[9px] text-text-soft uppercase font-semibold">{t.status}</span>
                </div>
              </div>
            ))}
            {pendingTickets.length === 0 && (
              <div className="text-center text-xs text-text-muted py-6 italic">No pending tickets.</div>
            )}
          </div>
        </div>

        {/* Active Tasks */}
        <div className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow backdrop-blur-[12px] hover:shadow-lg transition-all duration-300">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ClipboardList size={13} className="text-accent-purple" /> Active Tasks
          </h3>
          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {activeTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => handleTaskClick(t.id)}
                className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-cyan/20 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3 cursor-pointer transition-all flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-xs font-semibold text-text-primary block truncate max-w-[180px]">{t.title}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`rounded-badge px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider ${getCategoryColorBadge(t.category)}`}>
                      {t.category}
                    </span>
                    <span className="text-[10px] text-text-muted font-medium">• {formatMinutes(t.durationMinutes)}</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-text-soft uppercase tracking-wider flex-shrink-0">{t.status}</span>
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center text-xs text-text-muted py-6 italic">No active tasks.</div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Row 9: Meetings | Quick Notes */}
      <motion.div
        variants={itemVariants}
        className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
      >
        {/* Meetings */}
        <div className="rounded-card border border-transparent dark:border-white/5 bg-card-bg p-5 shadow-soft hover:shadow-glow backdrop-blur-[12px] hover:shadow-lg transition-all duration-300">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-3">
            <Users size={16} className="text-accent-purple" /> Meetings Scheduled ({rangeMeetings.length})
          </h3>
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {rangeMeetings.map((mt, idx) => {
              const startTime = mt.sessions.length > 0 ? mt.sessions[0].split("-")[0] : "All Day";
              return (
                <div
                  key={idx}
                  onClick={() => handleTaskClick(mt.id)}
                  className="rounded-input border border-border bg-[#0f172a]/4 dark:bg-white/5 hover:border-accent-purple/20 hover:bg-[#0f172a]/8 dark:hover:bg-white/10 p-3 cursor-pointer transition-all flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-xs font-semibold text-text-primary block truncate max-w-[150px]">{mt.title}</span>
                    <span className="text-[10px] text-text-muted mt-0.5 block">{startTime} • {formatMinutes(mt.durationMinutes)}</span>
                  </div>
                  <span className={`text-[9px] font-bold rounded-badge px-2 py-0.5 uppercase ${
                    mt.status === "completed" ? "bg-success/20 text-success border border-success/25" : "bg-warning/20 text-warning border border-warning/25"
                  }`}>
                    {mt.status}
                  </span>
                </div>
              );
            })}
            {rangeMeetings.length === 0 && (
              <div className="rounded-input border border-dashed border-border bg-[#0f172a]/4 dark:bg-white/5 p-6 text-center text-xs text-text-muted">
                No meetings scheduled.
              </div>
            )}
          </div>
        </div>

        {/* Quick Notes (Sticky Notes persistent) */}
        <div className="rounded-card border p-5 shadow-soft flex flex-col justify-between relative transition-all duration-300
          dark:border-amber-500/20 dark:bg-[#1a1506] dark:hover:border-amber-500/40 dark:hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
          <div className="absolute right-3 top-3 dark:text-amber-500/30">
            <Pin size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 dark:text-amber-400">
              <Bookmark size={15} /> Sticky Quick Notes
            </h3>
            <textarea
              value={quickNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Jot down quick reminders, scrap details, or draft tickets... (Autosaved locally)"
              className="w-full h-[120px] bg-transparent border-none outline-none text-xs font-mono resize-none leading-relaxed
                dark:text-amber-50/80 dark:placeholder:text-amber-500/25"
            />
          </div>
          <div className="text-[9px] mt-2 font-mono flex items-center justify-between dark:text-amber-500/40">
            <span>Sticky Note Widget</span>
            <span>Local Sync Active</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Action Forms Overlays */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSubmit={handleCreateTask}
      />

      <TicketForm
        isOpen={isTicketFormOpen}
        onClose={() => setIsTicketFormOpen(false)}
        onSubmit={handleCreateTicket}
      />
    </motion.div>
  );
}

function HelpCirclePlaceholder(props: React.ComponentProps<"svg"> & { size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
