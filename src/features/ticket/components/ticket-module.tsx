"use client";

import { motion } from "framer-motion";
import { Search, Trash2, Edit, Calendar, User, Info } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { TicketForm } from "./ticket-form";
import type { Ticket, TicketPriority, TicketStatus } from "../types";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";

const statuses: Array<TicketStatus | "all"> = [
  "all",
  "Open",
  "In Progress",
  "Awaiting Information",
  "On Hold",
  "Resolved",
  "Closed",
];
const priorities: Array<TicketPriority | "all"> = ["all", "P1", "P2", "P3", "P4", "P5", "P6"];

interface TicketModuleProps {
  selectedTicketId?: string | null;
  onSelectTicket?: (id: string | null) => void;
}

export function TicketModule({ selectedTicketId: propSelectedTicketId, onSelectTicket }: TicketModuleProps = {}) {
  const {
    tickets,
    addTicket,
    updateTicket,
    deleteTicket,
    loadingTickets,
    products,
  } = useNestor();

  // Search & Filter states
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [priority, setPriority] = useState<TicketPriority | "all">("all");
  const [product, setProduct] = useState("all");

  // Date Filter states
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStart, setCustomStart] = useState("2026-07-01");
  const [customEnd, setCustomEnd] = useState("2026-07-12");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Selection & Modal States
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(propSelectedTicketId ?? null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<Ticket | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (propSelectedTicketId !== undefined && propSelectedTicketId !== null) {
      setSelectedTicketId(propSelectedTicketId);
    }
  }, [propSelectedTicketId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTicketToEdit(null);
  };

  const handleSelectTicket = (id: string | null) => {
    setSelectedTicketId(id);
    onSelectTicket?.(id);
  };

  // Get unique products for filtering dropdown
  const uniqueProducts = useMemo(() => {
    return ["all", ...products];
  }, [products]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // 1. Search by Ticket ID, Subject, Client details, Raised by, Notes, Comments, etc.
      const query = search.toLowerCase();
      const matchesSearch =
        search.length === 0 ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        (ticket.customerId || "").toLowerCase().includes(query) ||
        (ticket.customerName || "").toLowerCase().includes(query) ||
        (ticket.raisedBy || "").toLowerCase().includes(query) ||
        (ticket.details || "").toLowerCase().includes(query) ||
        (ticket.myWork || "").toLowerCase().includes(query) ||
        (ticket.myNote || "").toLowerCase().includes(query) ||
        ticket.comments.some((c) => c.content.toLowerCase().includes(query) || c.author.toLowerCase().includes(query));

      // 2. Status Filter
      const matchesStatus = status === "all" || ticket.status === status;

      // 3. Priority Filter
      const matchesPriority = priority === "all" || ticket.priority === priority;

      // 4. Product Filter
      const matchesProduct = product === "all" || ticket.product === product;

      // 5. Date Filter
      const matchesDate = (() => {
        if (dateFilter === "all") return true;
        
        const d = new Date();
        const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        
        if (dateFilter === "today") {
          return ticket.date === todayStr;
        }
        if (dateFilter === "week") {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;
          
          return ticket.date >= startStr && ticket.date <= endStr;
        }
        if (dateFilter === "month") {
          const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
          return ticket.date.startsWith(currentMonthStr);
        }
        if (dateFilter === "custom") {
          return ticket.date >= customStart && ticket.date <= customEnd;
        }
        return true;
      })();

      return matchesSearch && matchesStatus && matchesPriority && matchesProduct && matchesDate;
    });
  }, [search, status, priority, product, dateFilter, customStart, customEnd, tickets]);

  // Paginated List (20 items max)
  const totalPages = Math.ceil(filteredTickets.length / 20);
  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredTickets, currentPage]);

  // Selected Ticket details
  const selectedTicket = useMemo(() => {
    if (selectedTicketId !== null) {
      const found = tickets.find((t) => t.id === selectedTicketId);
      if (found) return found;
    }
    return paginatedTickets[0] ?? null;
  }, [selectedTicketId, paginatedTickets, tickets]);

  const handleCreateTicket = async (data: Ticket) => {
    await addTicket(data);
  };

  const handleEditTicket = async (data: Ticket) => {
    await updateTicket(data);
    setTicketToEdit(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Are you sure you want to delete ticket ${id}?`)) {
      await deleteTicket(id);
      if (selectedTicketId === id) {
        handleSelectTicket(null);
      }
    }
  };

  const openAddModal = () => {
    setTicketToEdit(null);
    setIsFormOpen(true);
  };

  const openEditModal = (ticket: Ticket) => {
    setTicketToEdit(ticket);
    setIsFormOpen(true);
  };

  if (loadingTickets) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
        <span className="ml-3">Loading tickets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ticket Header with Inline Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft md:flex-row md:items-center md:justify-between relative z-40 dark:border-white/5 dark:bg-white/5"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">Ticket Log</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Operational tickets</h2>
        </div>

        {/* Date Filter & Add Ticket controls */}
        <div className="flex flex-wrap items-center gap-3 relative z-30">
          <CustomSelect
            value={dateFilter}
            onChange={(val) => { setDateFilter(val as any); setCurrentPage(1); }}
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
                onChange={(e) => { setCustomStart(e.target.value); setCurrentPage(1); }}
                className="rounded-badge border border-border px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-cyan dark:bg-white/5"
              />
              <span className="text-text-soft text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setCurrentPage(1); }}
                className="rounded-badge border border-border px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-cyan dark:bg-white/5"
              />
            </div>
          )}

          <button
            onClick={openAddModal}
            className="rounded-btn bg-gradient-to-r from-[#ec4899] via-[#f43f5e] to-[#e11d48] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(236,72,153,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            + Add Ticket
          </button>
        </div>
      </motion.div>

      {/* Filter Inputs Toolbar */}
      <div className="grid gap-4 rounded-card border p-4 shadow-soft backdrop-blur-[18px] sm:grid-cols-2 md:grid-cols-4 relative z-30 dark:border-white/5 dark:bg-card-bg">
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Search</span>
          <div className="flex items-center gap-2 rounded-input border px-3 py-2 transition-colors focus-within:border-accent-cyan focus-within:shadow-[0_0_20px_rgba(34,211,238,.25)] dark:border-white/10 dark:bg-white/5">
            <Search size={16} strokeWidth={1.75} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder="Search by Ticket ID / Subject"
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-soft"
            />
          </div>
        </label>
        
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Status</span>
          <CustomSelect
            value={status}
            onChange={(val) => { setStatus(val as any); setCurrentPage(1); }}
            options={statuses.map((option) => ({
              value: option,
              label: option === "all" ? "All Statuses" : option,
            }))}
            width="w-full"
          />
        </label>

        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Priority</span>
          <CustomSelect
            value={priority}
            onChange={(val) => { setPriority(val as any); setCurrentPage(1); }}
            options={priorities.map((option) => ({
              value: option,
              label: option === "all" ? "All Priorities" : option,
            }))}
            width="w-full"
          />
        </label>

        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Product</span>
          <CustomSelect
            value={product}
            onChange={(val) => { setProduct(val); setCurrentPage(1); }}
            options={uniqueProducts.map((option) => ({
              value: option,
              label: option === "all" ? "All Products" : option,
            }))}
            width="w-full"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Side List with Pagination */}
        <div className="space-y-3">
          {paginatedTickets.map((ticket) => {
            const isSelected = selectedTicket?.id === ticket.id;

            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => handleSelectTicket(ticket.id)}
                onDoubleClick={() => openEditModal(ticket)}
                className={`w-full rounded-card border p-4 text-left shadow-soft transition-all duration-300 ease-in-out relative overflow-hidden select-none ${
                  isSelected
                    ? "border-accent-cyan/50 bg-accent-cyan/15 dark:bg-accent-cyan/20"
                    : "border-white/5 bg-card-bg hover:-translate-y-1 hover:border-accent-cyan/30 hover:bg-accent-cyan/5 dark:hover:bg-accent-cyan/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-badge bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20">
                        {ticket.id}
                      </span>
                      <p className="text-sm font-semibold text-text-primary line-clamp-1">{ticket.subject}</p>
                    </div>
                    <p className={`mt-1 text-sm ${isSelected ? "text-text-muted" : "text-text-soft"}`}>
                      {ticket.customerName} • {ticket.product} • {ticket.date}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span
                      className={`rounded-badge px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                        ticket.status === "Closed" || ticket.status === "Resolved"
                          ? "bg-success/20 text-success border border-success/30"
                          : ticket.status === "Open"
                          ? "bg-danger/20 text-danger border border-danger/30"
                          : "bg-warning/20 text-warning border border-warning/30"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-text-muted">
                    Raised by: <span className="text-text-soft font-medium">{ticket.raisedBy}</span>
                  </span>
                  <span
                    className={`rounded-badge px-2 py-0.5 text-xs font-bold ${
                      ticket.priority === "P1" || ticket.priority === "P2"
                        ? "bg-danger/25 text-danger border border-danger/30"
                        : "bg-[#0f172a]/4 dark:bg-white/5 text-text-muted border border-white/10"
                    }`}
                  >
                    Priority {ticket.priority}
                  </span>
                </div>
              </button>
            );
          })}

          {filteredTickets.length === 0 && (
            <div className="rounded-card border border-dashed border-white/10 bg-[#0f172a]/4 dark:bg-white/5 p-6 text-center text-sm text-text-muted">
              No tickets match the current filters yet.
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="rounded-btn border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-white/10 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-text-muted font-medium">
                Page {currentPage} of {totalPages} ({filteredTickets.length} tickets)
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="rounded-btn border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-white/10 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Side Detail Sidebar */}
        <div className="rounded-card border border-white/5 bg-card-bg p-5 shadow-soft backdrop-blur-[18px] self-start space-y-6">
          {selectedTicket ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-badge bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20">
                      {selectedTicket.id}
                    </span>
                    <span className="text-xs text-text-soft flex items-center gap-1">
                      <Calendar size={12} /> {selectedTicket.date}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mt-2">{selectedTicket.subject}</h3>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span
                    className={`rounded-badge px-2.5 py-1 text-xs font-bold uppercase ${
                      selectedTicket.status === "Closed" || selectedTicket.status === "Resolved"
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {selectedTicket.status}
                  </span>
                  <span className="text-xs text-text-muted">
                    Priority {selectedTicket.priority}
                  </span>
                </div>
              </div>

              {/* Client Info Card */}
              <div className="rounded-input border border-white/5 bg-white/5 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-soft">
                  <User size={13} /> Client Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-text-soft">Client Name</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedTicket.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-soft">Client ID</p>
                    <p className="font-semibold text-text-primary mt-0.5">{selectedTicket.customerId}</p>
                  </div>
                </div>
              </div>

              {/* Details / Description */}
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                  <Info size={13} /> Description Details
                </div>
                <p className="text-sm leading-6 text-text-muted bg-white/5 border border-white/5 p-3 rounded-input whitespace-pre-wrap">
                  {selectedTicket.details}
                </p>
              </div>

              {/* Product & Raised By */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-text-soft font-semibold uppercase">Product</p>
                  <p className="font-semibold text-text-primary mt-1">{selectedTicket.product}</p>
                </div>
                <div>
                  <p className="text-xs text-text-soft font-semibold uppercase">Raised By</p>
                  <p className="font-semibold text-text-primary mt-1">{selectedTicket.raisedBy}</p>
                </div>
              </div>

              {/* Work Log Timeline */}
              {(() => {
                const logs = selectedTicket.workLogs || [];
                // Also check legacy myWork field as a final fallback
                if (logs.length === 0 && !selectedTicket.myWork) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-soft mb-3 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-accent-cyan animate-pulse" />
                      Work Log
                      {logs.length > 0 && (
                        <span className="rounded-badge bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20 px-1.5 py-0.5 text-[10px] font-bold">
                          {logs.length} {logs.length === 1 ? "entry" : "entries"}
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      {logs.length > 0 ? (
                        logs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-input border border-white/5 bg-white/[0.03] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-accent-cyan">{log.authorName}</span>
                              <span className="text-text-muted font-mono">{log.date}</span>
                            </div>
                            {log.myWork && (
                              <p className="text-text-muted leading-5 whitespace-pre-wrap mb-1">{log.myWork}</p>
                            )}
                            {log.myNote && (
                              <p className="text-text-soft italic leading-5 whitespace-pre-wrap border-t border-white/5 pt-1 mt-1">
                                Note: {log.myNote}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        /* Legacy fallback for tickets without work log records */
                        selectedTicket.myWork && (
                          <div className="rounded-input border border-white/5 bg-white/[0.03] p-3 text-xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-accent-cyan">{selectedTicket.raisedBy}</span>
                              <span className="text-text-muted font-mono">{selectedTicket.date}</span>
                            </div>
                            <p className="text-text-muted leading-5 whitespace-pre-wrap">{selectedTicket.myWork}</p>
                            {selectedTicket.myNote && (
                              <p className="text-text-soft italic leading-5 whitespace-pre-wrap border-t border-white/5 pt-1 mt-1">
                                Note: {selectedTicket.myNote}
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
                <button
                  onClick={() => handleDelete(selectedTicket.id)}
                  className="inline-flex items-center gap-2 rounded-btn bg-danger/10 hover:bg-danger/20 border border-danger/20 px-4 py-2.5 text-xs font-semibold text-danger transition-colors"
                >
                  <Trash2 size={14} /> Delete Ticket
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-8">Select a ticket to see its detail view.</p>
          )}
        </div>
      </div>

      {/* Ticket Modal Form */}
      <TicketForm
        key={ticketToEdit ? `edit-${ticketToEdit.id}` : "new"}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={ticketToEdit ? handleEditTicket : handleCreateTicket}
        ticketToEdit={ticketToEdit}
      />
    </div>
  );
}
