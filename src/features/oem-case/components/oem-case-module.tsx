"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNestor } from "@/src/shared/context/nestor-context";
import {
  ShieldCheck,
  Plus,
  Search,
  AlertCircle,
  Clock3,
  CheckCircle2,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  UserCheck,
} from "lucide-react";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import { OemCaseForm } from "./oem-case-form";
import type { OemCase } from "../types";

export function OemCaseModule({
  selectedOemCaseId,
  onSelectOemCase,
}: {
  selectedOemCaseId?: string | null;
  onSelectOemCase?: (id: string | null) => void;
} = {}) {
  const {
    oemCases,
    loadingOemCases,
    addOemCase,
    updateOemCase,
    deleteOemCase,
    caseTypes,
    statusUpdates,
    productCategories,
    role,
  } = useNestor();

  // Filters state
  const [search, setSearch] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Date Filter State (based on "Last Updated Date" -> updatedDate)
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<OemCase | null>(null);

  // Handle deep-linking from dashboard
  useEffect(() => {
    if (selectedOemCaseId) {
      const found = oemCases.find((c) => c.id === selectedOemCaseId);
      if (found) {
        setCaseToEdit(found);
        setIsFormOpen(true);
      }
      // Clear the ID so it doesn't re-trigger if closed
      onSelectOemCase?.(null);
    }
  }, [selectedOemCaseId, oemCases, onSelectOemCase]);

  // Helper for calculated aging (days)
  const calculateAging = (createdDateStr: string, closureDateStr?: string | null): number => {
    if (!createdDateStr) return 0;
    const start = new Date(createdDateStr).getTime();
    const end = closureDateStr ? new Date(closureDateStr).getTime() : new Date().getTime();
    const diff = end - start;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  // Filtered cases list
  const filteredCases = useMemo(() => {
    return oemCases.filter((c) => {
      // Search
      const s = search.toLowerCase().trim();
      const matchSearch =
        !s ||
        (c.oemCaseId || "").toLowerCase().includes(s) ||
        (c.internalTicketId || "").toLowerCase().includes(s) ||
        (c.title || "").toLowerCase().includes(s) ||
        (c.clientName || "").toLowerCase().includes(s) ||
        (c.productName || "").toLowerCase().includes(s);

      // Case Type
      const matchType = caseTypeFilter === "all" || c.caseType === caseTypeFilter;

      // Priority
      const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;

      // Status
      const matchStatus = statusFilter === "all" || c.statusUpdate === statusFilter;

      // Date Filter (based on "Last Updated Date" -> updatedDate)
      const matchesDate = (() => {
        if (dateFilter === "all") return true;

        const caseDate = c.updatedDate || c.createdDate || "";
        if (!caseDate) return true;

        const d = new Date();
        const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        if (dateFilter === "today") {
          return caseDate === todayStr;
        }
        if (dateFilter === "week") {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;

          return caseDate >= startStr && caseDate <= endStr;
        }
        if (dateFilter === "month") {
          const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
          return caseDate.startsWith(currentMonthStr);
        }
        if (dateFilter === "custom") {
          return caseDate >= customStart && caseDate <= customEnd;
        }
        return true;
      })();

      return matchSearch && matchType && matchPriority && matchStatus && matchesDate;
    });
  }, [oemCases, search, caseTypeFilter, priorityFilter, statusFilter, dateFilter, customStart, customEnd]);

  // Metrics
  const metrics = useMemo(() => {
    const total = oemCases.length;
    const pendingFromOem = oemCases.filter((c) => (c.statusUpdate || "").toLowerCase().includes("pending from oem")).length;
    const resolved = oemCases.filter((c) => (c.statusUpdate || "").toLowerCase().includes("resolved")).length;
    
    let totalAging = 0;
    oemCases.forEach((c) => {
      totalAging += calculateAging(c.createdDate, c.closureDate);
    });
    const avgAging = total > 0 ? Math.round(totalAging / total) : 0;

    return { total, pendingFromOem, resolved, avgAging };
  }, [oemCases]);

  const openAddModal = () => {
    setCaseToEdit(null);
    setIsFormOpen(true);
  };

  const openEditModal = (c: OemCase) => {
    setCaseToEdit(c);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (data: Omit<OemCase, "id" | "agingDays">) => {
    if (caseToEdit) {
      updateOemCase({
        ...data,
        id: caseToEdit.id,
      });
    } else {
      addOemCase(data);
    }
  };

  if (loadingOemCases) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
        <span className="ml-3">Loading OEM cases...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Panel ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft md:flex-row md:items-center md:justify-between relative z-40 dark:border-white/5 dark:bg-white/5"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">Vendor Management</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">OEM Case Log</h2>
        </div>

        {/* Date Filter & Log OEM Case controls */}
        <div className="flex flex-wrap items-center gap-3 relative z-30">
          <CustomSelect
            value={dateFilter}
            onChange={(val) => setDateFilter(val as any)}
            options={[
              { value: "all", label: "All time" },
              { value: "today", label: "Current Day" },
              { value: "week", label: "Current Week" },
              { value: "month", label: "Current Month" },
              { value: "custom", label: "Custom Range" },
            ]}
            width="w-44"
          />

          {/* Inline custom date inputs */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-badge border border-border px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-cyan dark:bg-white/5"
              />
              <span className="text-text-soft text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-badge border border-border px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-cyan dark:bg-white/5"
              />
            </div>
          )}

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-btn bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(6,182,212,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            <Plus size={15} strokeWidth={2.5} /> Log OEM Case
          </button>
        </div>
      </motion.div>

      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-[20px] border p-4 shadow-soft flex flex-col justify-between dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white"
        >
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
            <ShieldCheck size={16} />
          </div>
          <div className="mt-3 text-right">
            <span className="text-2xl font-bold text-text-primary block">{metrics.total}</span>
            <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Total Cases Logged</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-[20px] border p-4 shadow-soft flex flex-col justify-between dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white"
        >
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlertCircle size={16} />
          </div>
          <div className="mt-3 text-right">
            <span className="text-2xl font-bold text-amber-500 block">{metrics.pendingFromOem}</span>
            <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Pending From OEM</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-[20px] border p-4 shadow-soft flex flex-col justify-between dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white"
        >
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-3 text-right">
            <span className="text-2xl font-bold text-emerald-500 block">{metrics.resolved}</span>
            <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Resolved Cases</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-[20px] border p-4 shadow-soft flex flex-col justify-between dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white"
        >
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
            <Clock3 size={16} />
          </div>
          <div className="mt-3 text-right">
            <span className="text-2xl font-bold text-accent-purple block">{metrics.avgAging}d</span>
            <span className="text-[10px] font-semibold text-text-soft uppercase tracking-wide">Average Aging</span>
          </div>
        </motion.div>
      </div>

      {/* ── Toolbar & Filters Bar ── */}
      <div className="grid gap-4 rounded-card border p-4 shadow-soft backdrop-blur-[18px] sm:grid-cols-2 md:grid-cols-4 relative z-30 dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white">
        {/* Search */}
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Search</span>
          <div className="flex items-center gap-2 rounded-input border px-3 py-2 transition-colors focus-within:border-accent-cyan dark:border-white/10 dark:bg-white/5 light:border-slate-200 light:bg-slate-50">
            <Search size={16} strokeWidth={1.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Case ID / Title / Product..."
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-soft"
            />
          </div>
        </label>

        {/* Case Type */}
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Case Type</span>
          <CustomSelect
            value={caseTypeFilter}
            onChange={(val) => setCaseTypeFilter(val)}
            options={[
              { value: "all", label: "All Case Types" },
              ...caseTypes.map((t) => ({ value: t, label: t })),
            ]}
            width="w-full"
          />
        </label>

        {/* Priority */}
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Priority</span>
          <CustomSelect
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val)}
            options={[
              { value: "all", label: "All Priorities" },
              { value: "P1", label: "P1 (Highest)" },
              { value: "P2", label: "P2" },
              { value: "P3", label: "P3" },
              { value: "P4", label: "P4" },
              { value: "P5", label: "P5" },
              { value: "P6", label: "P6 (Lowest)" },
            ]}
            width="w-full"
          />
        </label>

        {/* Status Update */}
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Status Update</span>
          <CustomSelect
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: "all", label: "All Status Updates" },
              ...statusUpdates.map((s) => ({ value: s, label: s })),
            ]}
            width="w-full"
          />
        </label>
      </div>

      {/* ── OEM Cases Table ── */}
      <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg light:border-slate-200 light:bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02] light:border-slate-100">
              <tr>
                {["OEM CASE ID", "PRODUCT / CAT", "CLIENT", "CASE TITLE", "TYPE", "PRIORITY", "STATUS UPDATE", "AGING", "ASSIGNED / RAISED BY", "ACTIONS"].map((h) => (
                  <th key={h} className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-white/5 light:divide-slate-100">
              {filteredCases.map((c) => {
                const aging = calculateAging(c.createdDate, c.closureDate);
                const isClosed = (c.statusUpdate || "").toLowerCase().includes("resolved");

                return (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                    {/* Case ID & Internal Ref */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <span className="font-bold text-accent-cyan block">{c.oemCaseId}</span>
                      {c.internalTicketId && (
                        <span className="text-[10px] text-text-soft block mt-0.5">Ref: {c.internalTicketId}</span>
                      )}
                    </td>

                    {/* Product & Category */}
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-semibold text-text-primary block">{c.productName}</span>
                      <span className="rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 px-1.5 py-0.5 text-[9px] font-bold uppercase inline-block mt-0.5">
                        {c.productCategory}
                      </span>
                    </td>

                    {/* Client Name */}
                    <td className="py-3.5 px-4 text-xs font-medium text-text-primary">
                      {c.clientName || "—"}
                      {c.clientId && <span className="text-[10px] text-text-soft block font-mono">({c.clientId})</span>}
                    </td>

                    {/* Case Title */}
                    <td className="py-3.5 px-4 text-xs text-text-primary max-w-[220px]">
                      <span className="font-semibold block truncate" title={c.title}>{c.title}</span>
                      {c.description && <span className="text-[10px] text-text-soft block truncate mt-0.5" title={c.description}>{c.description}</span>}
                    </td>

                    {/* Case Type */}
                    <td className="py-3.5 px-4 text-xs text-text-soft font-medium">
                      {c.caseType}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          c.priority === "P1" || c.priority === "P2"
                            ? "bg-red-500/20 text-red-500"
                            : c.priority === "P3"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>

                    {/* Status Update */}
                    <td className="py-3.5 px-4 text-xs">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider inline-block ${
                          isClosed
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            : (c.statusUpdate || "").toLowerCase().includes("pending from oem")
                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                            : "bg-accent-purple/15 text-accent-purple border border-accent-purple/30"
                        }`}
                      >
                        {c.statusUpdate}
                      </span>
                      {c.updatedDate && (
                        <span className="text-[10px] text-text-soft block mt-1 font-mono">Updated: {c.updatedDate}</span>
                      )}
                    </td>

                    {/* Aging Days Badge */}
                    <td className="py-3.5 px-4 text-xs font-mono">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isClosed
                          ? "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400"
                          : aging > 7
                          ? "bg-red-500/15 text-red-500 border border-red-500/30"
                          : "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                      }`}>
                        {aging} {aging === 1 ? "day" : "days"}
                      </span>
                    </td>

                    {/* Assigned To & Raised By */}
                    <td className="py-3.5 px-4 text-xs text-text-muted">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-primary font-medium flex items-center gap-1">
                          <UserCheck size={11} className="text-accent-cyan" /> {c.assignedTo}
                        </span>
                        <span className="text-[10px] text-text-soft">Raised: {c.raisedBy}</span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="rounded-btn p-1.5 text-text-soft hover:bg-white/10 hover:text-accent-cyan transition-colors"
                          title="Edit OEM Case"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteOemCase(c.id)}
                          className="rounded-btn p-1.5 text-text-soft hover:bg-danger/10 hover:text-danger transition-colors"
                          title="Delete OEM Case"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-text-muted italic">
                    No OEM Cases logged matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OEM Case Form Modal */}
      <OemCaseForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        caseToEdit={caseToEdit}
      />
    </div>
  );
}
