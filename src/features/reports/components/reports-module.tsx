"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNestor } from "@/src/shared/context/nestor-context";
import {
  Calendar,
  FileSpreadsheet,
  FileCode,
  FileDown,
  Ticket as TicketIcon,
  Workflow,
  ChevronDown,
  Layers,
  Clock3,
  AlertCircle,
  CheckCircle,
  Award,
} from "lucide-react";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


type ReportType = "overall" | "tickets" | "tasks" | "shifts" | "meetings" | "learning";
type PeriodType = "today" | "week" | "month" | "custom";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "overall", label: "Overall Report (Tickets + Tasks)" },
  { value: "tickets", label: "Ticket Log Report" },
  { value: "tasks", label: "Task Log Report" },
  { value: "shifts", label: "Shift Report" },
  { value: "meetings", label: "Meeting Report" },
  { value: "learning", label: "Learning Report" },
];

export function ReportsModule() {
  const { tasks, tickets, rosterAssignments, shiftPresets, employeeId, categories, products, username } = useNestor();

  const [reportType, setReportType] = useState<ReportType>("overall");
  const [period, setPeriod] = useState<PeriodType>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");



  // ─── Date range calculations ───────────────────────────────────────────────
  const dateRanges = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const todayStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // Week: Monday–Sunday
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(y, m, d + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    return { todayStr, monday, sunday, monthStart, monthEnd };
  }, []);

  const matchesRange = useCallback(
    (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);

      if (period === "today") return dateStr === dateRanges.todayStr;
      if (period === "week") return d >= dateRanges.monday && d <= dateRanges.sunday;
      if (period === "month") return d >= dateRanges.monthStart && d <= dateRanges.monthEnd;
      if (period === "custom") {
        if (!customStart || !customEnd) return true;
        const s = new Date(customStart); s.setHours(0, 0, 0, 0);
        const e = new Date(customEnd); e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
      }
      return true;
    },
    [period, customStart, customEnd, dateRanges]
  );

  // ─── Filtered data ─────────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => tickets.filter((t) => matchesRange(t.date)), [tickets, matchesRange]);
  const filteredTasks   = useMemo(() => tasks.filter((t) => matchesRange(t.date)),   [tasks, matchesRange]);
  const filteredShifts = useMemo(() => {
    if (!employeeId) return [];
    
    // rosterAssignments keys are `employeeId_YYYY-MM-DD`
    return Object.entries(rosterAssignments)
      .filter(([key]) => key.startsWith(`${employeeId}_`))
      .map(([key, shiftCode]) => {
        const dateStr = key.split("_").slice(1).join("_");
        return { dateStr, shiftCode };
      })
      .filter(({ dateStr }) => matchesRange(dateStr))
      .map(({ dateStr, shiftCode }) => {
        const preset = shiftPresets.find((p) => p.code === shiftCode);
        const name = preset ? preset.name : shiftCode;
        let inTime = "";
        let outTime = "";
        if (preset && preset.timeRange && preset.timeRange.includes("to")) {
          const parts = preset.timeRange.split("to");
          inTime = parts[0].trim();
          outTime = parts[1].trim();
        }
        
        const isOff = preset?.isOffOrLeave || preset?.code === "WO" || name.toLowerCase().includes("off");
        const isLeave = (!isOff && name.toLowerCase().includes("leave")) || preset?.code === "L";
        const normalizedName = isLeave ? "Leave" : (isOff ? "Week Off" : name);

        return {
          date: dateStr,
          shiftName: normalizedName,
          inTime,
          outTime,
          note: "",
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rosterAssignments, employeeId, shiftPresets, matchesRange]);
  const filteredMeetings = useMemo(() => filteredTasks.filter((t) => t.category === "Meeting"),  [filteredTasks]);
  const filteredLearning = useMemo(() => filteredTasks.filter((t) => t.category === "Learning"), [filteredTasks]);

  const activeTaskSet = useMemo(() => {
    if (reportType === "meetings") return filteredMeetings;
    if (reportType === "learning") return filteredLearning;
    return filteredTasks;
  }, [reportType, filteredTasks, filteredMeetings, filteredLearning]);

  // ─── Period label ──────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (period === "today") return fmt(new Date(dateRanges.todayStr));
    if (period === "week")  return `${fmt(dateRanges.monday)} to ${fmt(dateRanges.sunday)}`;
    if (period === "month") return `${fmt(dateRanges.monthStart)} to ${fmt(dateRanges.monthEnd)}`;
    if (period === "custom") {
      if (!customStart || !customEnd) return "Custom Range";
      return `${fmt(new Date(customStart))} to ${fmt(new Date(customEnd))}`;
    }
    return "";
  }, [period, customStart, customEnd, dateRanges]);

  // ─── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalTk  = filteredTickets.length;
    const openTk   = filteredTickets.filter((t) => t.status !== "Closed" && t.status !== "Resolved").length;
    const closedTk = totalTk - openTk;

    const prodMap: Record<string, number> = {};
    filteredTickets.forEach((t) => { if (t.product) prodMap[t.product] = (prodMap[t.product] || 0) + 1; });
    let topProduct = "None"; let maxProd = 0;
    Object.entries(prodMap).forEach(([n, c]) => { if (c > maxProd) { maxProd = c; topProduct = `${n} (${c})`; } });

    const totalK     = filteredTasks.length;
    const completedK = filteredTasks.filter((t) => t.status === "completed").length;
    const pendingK   = totalK - completedK;
    const totalMins  = filteredTasks.reduce((s, t) => s + t.durationMinutes, 0);

    const totalSh  = filteredShifts.length;
    const leavesSh = filteredShifts.filter((s) => s.shiftName === "Leave").length;
    const offsSh   = filteredShifts.filter((s) => s.shiftName === "Week Off").length;
    const workedSh = totalSh - leavesSh - offsSh;
    const parseTime = (timeStr: string) => {
      if (!timeStr) return [0, 0];
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) {
        const parts = timeStr.split(":");
        return [Number(parts[0]) || 0, Number(parts[1]) || 0];
      }
      let h = Number(match[1]);
      const m = Number(match[2]);
      const isPM = match[3].toUpperCase() === "PM";
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return [h, m];
    };

    const shiftHrs = filteredShifts.reduce((sum, s) => {
      if (s.shiftName === "Leave" || s.shiftName === "Week Off") return sum;
      const [ih, im] = parseTime(s.inTime);
      const [oh, om] = parseTime(s.outTime);
      return sum + ((oh * 60 + om) - (ih * 60 + im)) / 60;
    }, 0);

    return { totalTk, openTk, closedTk, topProduct, totalK, completedK, pendingK, totalMins, totalSh, leavesSh, offsSh, workedSh, shiftHrs: Number(shiftHrs.toFixed(1)) };
  }, [filteredTickets, filteredTasks, filteredShifts]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const fmtMins = (m: number) => { const h = Math.floor(m / 60), mn = m % 60; return h ? `${h}h ${mn}m` : `${mn}m`; };

  // ─── Exporters ─────────────────────────────────────────────────────────────
  const downloadBlob = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCSV = () => {
    const q = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const row = (arr: string[]) => arr.map(q).join(",") + "\n";
    let csv = "";

    // ── Data Tables ──
    if (reportType === "overall" || reportType === "tickets") {
      csv += row(["Sr No.", "Date", "Product Name", "Ticket Id", "Customer ID", "Customer Name", "Subject", "Details", "Priority", "Requester", "Created Date", "Status", "My Task", "Comment"]);
      filteredTickets.forEach((t, i) => { 
        const commentsString = t.comments?.map(c => `[${c.author}] ${c.content}`).join("; ") || "";
        csv += row([
          String(i + 1), 
          t.date, 
          t.product || "", 
          t.id, 
          t.customerId, 
          t.customerName, 
          t.subject, 
          t.details, 
          t.priority, 
          t.raisedBy, 
          t.createdAt || t.date, 
          t.status, 
          t.myWork ? `'${t.myWork}` : "", 
          commentsString
        ]); 
      });
      csv += "\n";
    }
    if (reportType !== "tickets" && reportType !== "shifts") {
      csv += row(["Date", "Task Title", "Category", "Status", "Duration (min)", "Tags", "Notes", "Sessions", "Description"]);
      activeTaskSet.forEach((t) => { 
        csv += row([
          t.date, 
          t.title, 
          t.category, 
          t.status, 
          String(t.durationMinutes), 
          t.tags?.join(", ") || "", 
          t.notes || "", 
          t.sessions?.join("; ") || "", 
          t.description || ""
        ]); 
      });
      csv += "\n";
    }
    if (reportType === "shifts") {
      csv += row(["Date", "Shift", "In Time", "Out Time", "Note"]);
      filteredShifts.forEach((s) => { csv += row([s.date, s.shiftName, s.inTime || "", s.outTime || "", s.note || ""]); });
    }
    downloadBlob(csv, "text/csv;charset=utf-8;", `nestor_report_${reportType}_${period}.csv`);
  };

  const handleHTML = () => {
    const css = `body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b;padding:2rem;margin:0 auto}.container{background:#ffffff;max-width:1100px;margin:0 auto;padding:2.5rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0}h1{color:#0f172a;font-size:1.8rem;margin-bottom:.5rem;border-bottom:2px solid #3b82f6;padding-bottom:1rem}h2{color:#334155;margin-top:2.5rem;border-bottom:1px solid #cbd5e1;padding-bottom:.5rem;font-size:1.25rem}h3{color:#475569;font-size:1rem;margin-top:1.5rem;margin-bottom:.75rem}p.meta{color:#64748b;font-size:.9rem;margin-bottom:2rem;font-weight:500}table{width:100%;border-collapse:collapse;margin-top:1rem;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}th,td{padding:.85rem 1rem;text-align:left;border-bottom:1px solid #e2e8f0}th{background:#f1f5f9;color:#475569;text-transform:uppercase;font-size:.75rem;letter-spacing:.05em;font-weight:700}.badge{display:inline-block;padding:.25rem .6rem;border-radius:6px;font-size:.75rem;font-weight:700;text-transform:uppercase;background:#e2e8f0;color:#475569}.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin:1rem 0}.kpi{background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:1.25rem;box-shadow:0 2px 8px rgba(0,0,0,0.02)}.kpi-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:600}.kpi-value{font-size:1.75rem;font-weight:700;color:#0f172a;margin-top:.35rem}`;

    // ── Build analytics html ──
    let analytics = "";

    if (reportType === "overall" || reportType === "tickets") {
      const statusMap: Record<string, number> = {};
      const priorityMap: Record<string, number> = {};
      const productMap: Record<string, number> = {};
      filteredTickets.forEach((t) => {
        statusMap[t.status] = (statusMap[t.status] || 0) + 1;
        priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1;
        if (t.product) productMap[t.product] = (productMap[t.product] || 0) + 1;
      });
      analytics += `<h2>Analytics Summary</h2>`;
      analytics += `<div class="kpi-grid">`;
      analytics += `<div class="kpi"><div class="kpi-label">Total Tickets</div><div class="kpi-value">${metrics.totalTk}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:#f87171">${metrics.openTk}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Closed/Resolved</div><div class="kpi-value" style="color:#34d399">${metrics.closedTk}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Top Product</div><div class="kpi-value" style="font-size:.9rem;color:#22d3ee">${metrics.topProduct}</div></div>`;
      analytics += `</div>`;
      analytics += `<h3>Status Breakdown</h3><table><thead><tr><th>Status</th><th>Count</th><th>Share</th></tr></thead><tbody>${Object.entries(statusMap).map(([s,c])=>`<tr><td>${s}</td><td>${c}</td><td>${metrics.totalTk?Math.round(c/metrics.totalTk*100):0}%</td></tr>`).join("")}</tbody></table>`;
      analytics += `<h3>Priority Breakdown</h3><table><thead><tr><th>Priority</th><th>Count</th></tr></thead><tbody>${Object.entries(priorityMap).sort().map(([p,c])=>`<tr><td>${p}</td><td>${c}</td></tr>`).join("")}</tbody></table>`;
      if (Object.keys(productMap).length) {
        analytics += `<h3>Tickets by Product</h3><table><thead><tr><th>Product</th><th>Count</th></tr></thead><tbody>${Object.entries(productMap).sort((a,b)=>b[1]-a[1]).map(([p,c])=>`<tr><td>${p}</td><td>${c}</td></tr>`).join("")}</tbody></table>`;
      }
    }

    if (reportType !== "tickets" && reportType !== "shifts") {
      const catMap: Record<string, number> = {};
      const catMins: Record<string, number> = {};
      activeTaskSet.forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + 1;
        catMins[t.category] = (catMins[t.category] || 0) + t.durationMinutes;
      });
      const totalTaskMins = activeTaskSet.reduce((s,t)=>s+t.durationMinutes,0);
      const completedCount = activeTaskSet.filter(t=>t.status==="completed").length;
      analytics += `<h2>Analytics Summary</h2>`;
      analytics += `<div class="kpi-grid">`;
      analytics += `<div class="kpi"><div class="kpi-label">Total Tasks</div><div class="kpi-value">${activeTaskSet.length}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:#34d399">${completedCount}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:#fbbf24">${activeTaskSet.length-completedCount}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Time Logged</div><div class="kpi-value">${fmtMins(totalTaskMins)}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Completion Rate</div><div class="kpi-value">${activeTaskSet.length?Math.round(completedCount/activeTaskSet.length*100):0}%</div></div>`;
      analytics += `</div>`;
      analytics += `<h3>Category Breakdown</h3><table><thead><tr><th>Category</th><th>Task Count</th><th>Time Logged</th><th>Share of Time</th></tr></thead><tbody>${Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat,c])=>`<tr><td>${cat}</td><td>${c}</td><td>${fmtMins(catMins[cat]||0)}</td><td>${totalTaskMins?Math.round((catMins[cat]||0)/totalTaskMins*100):0}%</td></tr>`).join("")}</tbody></table>`;
    }

    if (reportType === "shifts") {
      const shiftTypeMap: Record<string, number> = {};
      filteredShifts.forEach((s) => { shiftTypeMap[s.shiftName] = (shiftTypeMap[s.shiftName] || 0) + 1; });
      analytics += `<h2>Analytics Summary</h2>`;
      analytics += `<div class="kpi-grid">`;
      analytics += `<div class="kpi"><div class="kpi-label">Total Assignments</div><div class="kpi-value">${metrics.totalSh}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Days Worked</div><div class="kpi-value" style="color:#34d399">${metrics.workedSh}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Leaves</div><div class="kpi-value" style="color:#f87171">${metrics.leavesSh}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Week Offs</div><div class="kpi-value" style="color:#94a3b8">${metrics.offsSh}</div></div>`;
      analytics += `<div class="kpi"><div class="kpi-label">Hours Logged</div><div class="kpi-value" style="color:#22d3ee">${metrics.shiftHrs}h</div></div>`;
      analytics += `</div>`;
      analytics += `<h3>Shift Type Breakdown</h3><table><thead><tr><th>Shift</th><th>Count</th></tr></thead><tbody>${Object.entries(shiftTypeMap).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<tr><td>${n}</td><td>${c}</td></tr>`).join("")}</tbody></table>`;
    }

    // ── Data tables ──
    let body = `<h1>Nestor Report — ${REPORT_OPTIONS.find(r => r.value === reportType)?.label}</h1><p class="meta">Period: ${periodLabel} | Exported: ${new Date().toLocaleString()}</p>${analytics}`;

    if (reportType === "overall" || reportType === "tickets") {
      body += `<h2>Ticket Log (${filteredTickets.length} records)</h2><table><thead><tr><th>SR</th><th>Date</th><th>Ticket ID</th><th>Customer</th><th>Subject</th><th>Product</th><th>Priority</th><th>Status</th></tr></thead><tbody>${filteredTickets.map((t, i) => `<tr><td>${i+1}</td><td>${t.date}</td><td style="color:#22d3ee"><strong>${t.id}</strong></td><td>${t.customerName}</td><td>${t.subject}</td><td>${t.product||"—"}</td><td><span class="badge">${t.priority}</span></td><td><span class="badge">${t.status}</span></td></tr>`).join("")}</tbody></table>`;
    }
    if (reportType !== "tickets" && reportType !== "shifts") {
      body += `<h2>Task Log (${activeTaskSet.length} records)</h2><table><thead><tr><th>Date</th><th>Task</th><th>Category</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead><tbody>${activeTaskSet.map((t) => `<tr><td>${t.date}</td><td><strong>${t.title}</strong></td><td>${t.category}</td><td><span class="badge">${t.status}</span></td><td>${fmtMins(t.durationMinutes)}</td><td style="color:#94a3b8">${t.description||"—"}</td></tr>`).join("")}</tbody></table>`;
    }
    if (reportType === "shifts") {
      body += `<h2>Shift Log (${filteredShifts.length} records)</h2><table><thead><tr><th>Date</th><th>Shift</th><th>Hours</th><th>Status</th><th>Note</th></tr></thead><tbody>${filteredShifts.map((s) => `<tr><td>${s.date}</td><td><strong>${s.shiftName}</strong></td><td>${s.shiftName !== "Leave" && s.shiftName !== "Week Off" ? `${s.inTime}–${s.outTime}` : "—"}</td><td><span class="badge">${s.shiftName === "Leave" ? "Leave" : s.shiftName === "Week Off" ? "Off" : "Active"}</span></td><td style="color:#94a3b8">${s.note||"—"}</td></tr>`).join("")}</tbody></table>`;
    }
    downloadBlob(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nestor Report</title><style>${css}</style></head><body>${body}</body></html>`, "text/html;charset=utf-8;", `nestor_report_${reportType}_${period}.html`);
  };

  // True one-click PDF download — generates a real .pdf file client-side via
  // jsPDF and saves it directly, rather than opening the browser's print
  // dialog and requiring a manual "Save as PDF" step.
  const handlePDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 50;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 40) {
        doc.addPage();
        y = 50;
      }
    };

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Nestor Report — ${REPORT_OPTIONS.find((r) => r.value === reportType)?.label}`, marginX, y);
    y += 18;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Period: ${periodLabel}   |   Exported: ${new Date().toLocaleString()}`, marginX, y);
    doc.setTextColor(0);
    y += 18;

    // ── KPI summary ──
    const kpis: [string, string][] = [];
    if (reportType === "overall") {
      kpis.push(
        ["Total Items", String(metrics.totalTk + metrics.totalK)],
        ["Tickets", String(metrics.totalTk)],
        ["Tasks", String(metrics.totalK)],
        ["Time Logged", fmtMins(metrics.totalMins)]
      );
    } else if (reportType === "tickets") {
      kpis.push(
        ["Total Tickets", String(metrics.totalTk)],
        ["Open", String(metrics.openTk)],
        ["Closed/Resolved", String(metrics.closedTk)],
        ["Top Product", metrics.topProduct]
      );
    } else if (reportType === "tasks") {
      kpis.push(
        ["Total Tasks", String(metrics.totalK)],
        ["Completed", String(metrics.completedK)],
        ["Pending", String(metrics.pendingK)],
        ["Time Logged", fmtMins(metrics.totalMins)]
      );
    } else if (reportType === "shifts") {
      kpis.push(
        ["Assignments", String(metrics.totalSh)],
        ["Days Worked", String(metrics.workedSh)],
        ["Leaves / Off", `${metrics.leavesSh} / ${metrics.offsSh}`],
        ["Hours Logged", `${metrics.shiftHrs}h`]
      );
    } else if (reportType === "meetings") {
      const totalMin = filteredMeetings.reduce((s, t) => s + t.durationMinutes, 0);
      kpis.push(
        ["Total Meetings", String(filteredMeetings.length)],
        ["Time Logged", fmtMins(totalMin)],
        ["Completed", String(filteredMeetings.filter((t) => t.status === "completed").length)]
      );
    } else if (reportType === "learning") {
      const totalMin = filteredLearning.reduce((s, t) => s + t.durationMinutes, 0);
      kpis.push(
        ["Total Sessions", String(filteredLearning.length)],
        ["Time Logged", fmtMins(totalMin)],
        ["Completed", String(filteredLearning.filter((t) => t.status === "completed").length)]
      );
    }

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: kpis,
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: marginX, right: marginX },
      tableWidth: 280,
    });
    y = (doc as any).lastAutoTable.finalY + 24;

    // ── Data tables ──
    if (reportType === "overall" || reportType === "tickets") {
      ensureSpace(60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Ticket Log (${filteredTickets.length} records)`, marginX, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [["SR", "Date", "Ticket ID", "Customer", "Subject", "Product", "Priority", "Status"]],
        body: filteredTickets.map((t, i) => [
          String(i + 1),
          t.date,
          t.id,
          t.customerName,
          t.subject,
          t.product || "—",
          t.priority,
          t.status,
        ]),
        styles: { fontSize: 8, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: marginX, right: marginX },
      });
      y = (doc as any).lastAutoTable.finalY + 24;
    }

    if (reportType !== "tickets" && reportType !== "shifts") {
      ensureSpace(60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const label = reportType === "meetings" ? "Meetings" : reportType === "learning" ? "Learning Sessions" : "Task Log";
      doc.text(`${label} (${activeTaskSet.length} records)`, marginX, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Task", "Category", "Status", "Duration"]],
        body: activeTaskSet.map((t) => [t.date, t.title, t.category, t.status, fmtMins(t.durationMinutes)]),
        styles: { fontSize: 8, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: marginX, right: marginX },
      });
      y = (doc as any).lastAutoTable.finalY + 24;
    }

    if (reportType === "shifts") {
      ensureSpace(60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Shift Log (${filteredShifts.length} records)`, marginX, y);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [["Date", "Shift", "Hours", "Note"]],
        body: filteredShifts.map((s) => [
          s.date,
          s.shiftName,
          s.shiftName !== "Leave" && s.shiftName !== "Week Off" ? `${s.inTime}–${s.outTime}` : "—",
          s.note || "—",
        ]),
        styles: { fontSize: 8, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: marginX, right: marginX },
      });
    }

    doc.save(`nestor_report_${reportType}_${period}.pdf`);
  };



  // ─── Shared table styles ───────────────────────────────────────────────────
  const thCls = "py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-text-soft border-b border-black/10 dark:border-white/5";
  const tdCls = "py-3 px-3 text-xs border-b border-black/5 dark:border-white/[0.02] transition-colors";

  // ─── Metric card helper ────────────────────────────────────────────────────
  const MetricCard = ({ label, value, color = "text-text-primary" }: { label: string; value: string | number; color?: string }) => {
    const l = label.toLowerCase();
    let IconComponent = Calendar;
    let badgeColor = "bg-accent-blue/10 text-accent-blue border border-accent-blue/20";

    if (l.includes("total items") || l.includes("assignments") || l.includes("total tasks") || l.includes("total tickets") || l.includes("total meetings") || l.includes("total sessions")) {
      IconComponent = Layers;
      badgeColor = "bg-slate-500/10 text-slate-500 border border-slate-500/20";
    } else if (l.includes("ticket")) {
      IconComponent = TicketIcon;
      badgeColor = "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20";
    } else if (l.includes("task") || l.includes("session")) {
      IconComponent = Workflow;
      badgeColor = "bg-accent-purple/10 text-accent-purple border border-accent-purple/20";
    } else if (l.includes("time") || l.includes("hour") || l.includes("duration")) {
      IconComponent = Clock3;
      badgeColor = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
    } else if (l.includes("open") || l.includes("pending") || l.includes("leave")) {
      IconComponent = AlertCircle;
      badgeColor = "bg-danger/10 text-danger border border-danger/20";
    } else if (l.includes("closed") || l.includes("completed") || l.includes("worked")) {
      IconComponent = CheckCircle;
      badgeColor = "bg-success/10 text-success border border-success/20";
    } else if (l.includes("product") || l.includes("avg")) {
      IconComponent = Award;
      badgeColor = "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    }

    return (
      <motion.div
        whileHover={{ y: -6, scale: 1.02 }}
        className="rounded-[20px] border p-4 h-[110px] shadow-soft flex flex-col justify-between cursor-pointer transition-all duration-300
          dark:border-white/5 dark:bg-card-bg dark:hover:shadow-glow"
      >
        <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${badgeColor} shadow-sm`}>
          <IconComponent size={16} />
        </div>
        <div className="mt-auto text-right">
          <span className="text-2xl font-bold tracking-tight text-text-primary block leading-none">{value}</span>
          <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide mt-1 block truncate" title={label}>{label}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Top header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft md:flex-row md:items-center md:justify-between dark:border-white/5 dark:bg-white/5"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">Reports</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Build &amp; Export Reports</h2>
        </div>
      </motion.div>

      {/* ── Controls bar ── */}
      <div className="rounded-card border border-black/10 dark:border-white/10 bg-card-bg p-4 shadow-glow backdrop-blur-[12px] relative z-30">
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Report selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-soft">Report</label>
              <CustomSelect
                value={reportType}
                onChange={(val) => setReportType(val as ReportType)}
                options={REPORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                width="w-[220px]"
              />
            </div>

            {/* Period tabs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-soft">Period</label>
              <div className="flex items-center gap-1 rounded-btn border border-black/10 dark:border-white/10 bg-[#0f172a]/4 dark:bg-white/[0.04] p-1">
                {(["today", "week", "month", "custom"] as PeriodType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-btn px-3 py-1.5 text-[11px] font-bold capitalize transition-all duration-200 cursor-pointer ${
                      period === p
                        ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30 shadow-[0_2px_10px_rgba(34,211,238,0.1)]"
                        : "text-text-soft hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom range */}
            {period === "custom" && (
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-soft">From</label>
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-input border px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-cyan transition-all duration-200 border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] focus:bg-slate-50 dark:focus:bg-[#111c30]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-soft">To</label>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-input border px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-cyan transition-all duration-200 border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] focus:bg-slate-50 dark:focus:bg-[#111c30]" />
                </div>
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button onClick={handleCSV}
              className="flex items-center gap-1.5 rounded-btn border border-success/20 bg-success/10 px-3.5 py-2 text-[11px] font-bold text-success hover:bg-success/20 transition-all duration-200 cursor-pointer shadow-[0_2px_10px_rgba(0,230,118,0.12)]">
              <FileSpreadsheet size={13} /> CSV
            </button>
            <button onClick={handleHTML}
              className="flex items-center gap-1.5 rounded-btn border border-warning/20 bg-warning/10 px-3.5 py-2 text-[11px] font-bold text-warning hover:bg-warning/20 transition-all duration-200 cursor-pointer shadow-[0_2px_10px_rgba(251,191,36,0.12)]">
              <FileCode size={13} /> HTML
            </button>
            <button onClick={handlePDF}
              className="flex items-center gap-1.5 rounded-btn bg-accent-cyan/10 border border-accent-cyan/20 px-3.5 py-2 text-[11px] font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-all duration-200 cursor-pointer shadow-[0_2px_10px_rgba(34,211,238,0.15)]">
              <FileDown size={13} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(reportType === "overall") && (
          <>
            <MetricCard label="Total Items"   value={metrics.totalTk + metrics.totalK} />
            <MetricCard label="Tickets"       value={metrics.totalTk}   color="text-accent-cyan" />
            <MetricCard label="Tasks"         value={metrics.totalK}    color="text-accent-purple" />
            <MetricCard label="Time Logged"   value={fmtMins(metrics.totalMins)} color="text-emerald-400" />
          </>
        )}
        {(reportType === "tickets") && (
          <>
            <MetricCard label="Total Tickets"    value={metrics.totalTk} />
            <MetricCard label="Open Tickets"     value={metrics.openTk}   color="text-red-400" />
            <MetricCard label="Closed/Resolved"  value={metrics.closedTk} color="text-emerald-400" />
            <MetricCard label="Top Product"      value={metrics.topProduct} color="text-accent-cyan" />
          </>
        )}
        {(reportType === "tasks") && (
          <>
            <MetricCard label="Total Tasks"    value={metrics.totalK} />
            <MetricCard label="Completed"      value={metrics.completedK} color="text-emerald-400" />
            <MetricCard label="Pending"        value={metrics.pendingK}   color="text-amber-400" />
            <MetricCard label="Time Logged"    value={fmtMins(metrics.totalMins)} color="text-accent-cyan" />
          </>
        )}
        {(reportType === "shifts") && (
          <>
            <MetricCard label="Assignments"  value={metrics.totalSh} />
            <MetricCard label="Days Worked"  value={metrics.workedSh} color="text-emerald-400" />
            <MetricCard label="Leaves / Off" value={`${metrics.leavesSh} / ${metrics.offsSh}`} color="text-red-400" />
            <MetricCard label="Hours Logged" value={`${metrics.shiftHrs}h`} color="text-accent-cyan" />
          </>
        )}
        {(reportType === "meetings") && (
          <>
            <MetricCard label="Total Meetings"  value={filteredMeetings.length} color="text-accent-purple" />
            <MetricCard label="Time Logged"     value={fmtMins(filteredMeetings.reduce((s, t) => s + t.durationMinutes, 0))} color="text-emerald-400" />
            <MetricCard label="Completed"       value={filteredMeetings.filter((t) => t.status === "completed").length} color="text-emerald-400" />
            <MetricCard label="Avg Duration"    value={filteredMeetings.length ? `${Math.round(filteredMeetings.reduce((s, t) => s + t.durationMinutes, 0) / filteredMeetings.length)}m` : "0m"} color="text-accent-cyan" />
          </>
        )}
        {(reportType === "learning") && (
          <>
            <MetricCard label="Total Sessions" value={filteredLearning.length} color="text-accent-purple" />
            <MetricCard label="Time Logged"    value={fmtMins(filteredLearning.reduce((s, t) => s + t.durationMinutes, 0))} color="text-emerald-400" />
            <MetricCard label="Completed"      value={filteredLearning.filter((t) => t.status === "completed").length} color="text-emerald-400" />
            <MetricCard label="Avg Study Time" value={filteredLearning.length ? `${Math.round(filteredLearning.reduce((s, t) => s + t.durationMinutes, 0) / filteredLearning.length)}m` : "0m"} color="text-accent-cyan" />
          </>
        )}
      </div>

      {/* ── Tables ── */}
      <div className="space-y-5">

        {/* Tickets table */}
        {(reportType === "overall" || reportType === "tickets") && (
          <div className="rounded-card border border-black/10 dark:border-white/10 bg-card-bg shadow-glow backdrop-blur-[12px] overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/5 px-5 py-3.5">
              <TicketIcon size={14} className="text-accent-cyan" />
              <span className="text-sm font-semibold text-text-primary">Tickets — {periodLabel}</span>
              <span className="ml-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 text-[10px] font-bold text-accent-cyan">{filteredTickets.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a]/2 dark:bg-white/[0.02]">
                  <tr>
                    {["SR NO", "DATE", "TICKET ID", "CUSTOMER", "SUBJECT", "PRIORITY", "STATUS", "MY TASK"].map((h) => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t, i) => (
                    <tr key={t.id} className="hover:bg-[#0f172a]/4 dark:hover:bg-white/[0.02]">
                      <td className={`${tdCls} font-mono text-text-soft`}>{i + 1}</td>
                      <td className={`${tdCls} font-mono whitespace-nowrap text-text-soft`}>{t.date}</td>
                      <td className={`${tdCls} font-bold font-mono text-accent-cyan`}>{t.id}</td>
                      <td className={`${tdCls} font-medium text-text-primary max-w-[100px] truncate`}>{t.customerName}</td>
                      <td className={`${tdCls} text-text-primary max-w-[180px] truncate`} title={t.subject}>{t.subject}</td>
                      <td className={tdCls}>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${t.priority === "P1" || t.priority === "P2" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-text-soft"}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className={`${tdCls} text-[9px] font-bold uppercase tracking-wide text-text-soft`}>{t.status}</td>
                      <td className={`${tdCls} text-text-muted max-w-[140px] truncate`}>{t.myWork || "—"}</td>
                    </tr>
                  ))}
                  {filteredTickets.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-xs text-text-muted italic">No tickets in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tasks table */}
        {(reportType === "overall" || reportType === "tasks" || reportType === "meetings" || reportType === "learning") && (
          <div className="rounded-card border border-black/10 dark:border-white/10 bg-card-bg shadow-glow backdrop-blur-[12px] overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/5 px-5 py-3.5">
              <Workflow size={14} className="text-accent-cyan" />
              <span className="text-sm font-semibold text-text-primary">
                {reportType === "meetings" ? "Meetings" : reportType === "learning" ? "Learning Sessions" : "Tasks"} — {periodLabel}
              </span>
              <span className="ml-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 text-[10px] font-bold text-accent-cyan">{activeTaskSet.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a]/2 dark:bg-white/[0.02]">
                  <tr>
                    {["DATE", "TASK", "CATEGORY", "STATUS", "TIME LOGGED", "DETAILS"].map((h) => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeTaskSet.map((t) => (
                    <tr key={t.id} className="hover:bg-[#0f172a]/4 dark:hover:bg-white/[0.02]">
                      <td className={`${tdCls} font-mono whitespace-nowrap text-text-soft`}>{t.date}</td>
                      <td className={`${tdCls} font-bold text-text-primary max-w-[180px] truncate`} title={t.title}>{t.title}</td>
                      <td className={`${tdCls} text-text-soft`}>{t.category}</td>
                      <td className={tdCls}>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${t.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : t.status === "in-progress" ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-text-soft"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className={`${tdCls} font-mono text-text-soft`}>{fmtMins(t.durationMinutes)}</td>
                      <td className={`${tdCls} text-text-muted max-w-[220px] truncate`} title={t.description}>{t.description || "—"}</td>
                    </tr>
                  ))}
                  {activeTaskSet.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-xs text-text-muted italic">No tasks in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shifts table */}
        {reportType === "shifts" && (
          <div className="rounded-card border border-black/10 dark:border-white/10 bg-card-bg shadow-glow backdrop-blur-[12px] overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-black/5 dark:border-white/5 px-5 py-3.5">
              <Calendar size={14} className="text-accent-cyan" />
              <span className="text-sm font-semibold text-text-primary">Shift Assignments — {periodLabel}</span>
              <span className="ml-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 px-2 py-0.5 text-[10px] font-bold text-accent-cyan">{filteredShifts.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f172a]/2 dark:bg-white/[0.02]">
                  <tr>
                    {["DATE", "SHIFT", "HOURS", "STATUS", "NOTE"].map((h) => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShifts.map((s, i) => (
                    <tr key={i} className="hover:bg-[#0f172a]/4 dark:hover:bg-white/[0.02]">
                      <td className={`${tdCls} font-mono whitespace-nowrap text-text-soft`}>{s.date}</td>
                      <td className={`${tdCls} font-bold text-text-primary`}>{s.shiftName}</td>
                      <td className={`${tdCls} font-mono text-text-soft`}>
                        {s.shiftName !== "Leave" && s.shiftName !== "Week Off" ? `${s.inTime} – ${s.outTime}` : "—"}
                      </td>
                      <td className={tdCls}>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${s.shiftName === "Leave" ? "bg-red-500/20 text-red-400" : s.shiftName === "Week Off" ? "bg-white/5 text-text-soft" : "bg-emerald-500/20 text-emerald-400"}`}>
                          {s.shiftName === "Leave" ? "Leave" : s.shiftName === "Week Off" ? "Off" : "Active"}
                        </span>
                      </td>
                      <td className={`${tdCls} text-text-muted max-w-[280px] truncate`} title={s.note}>{s.note || "—"}</td>
                    </tr>
                  ))}
                  {filteredShifts.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-xs text-text-muted italic">No shifts in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
