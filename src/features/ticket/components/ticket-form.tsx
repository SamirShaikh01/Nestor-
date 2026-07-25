"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import type { Ticket, TicketPriority, TicketStatus, TicketWorkLog } from "../types";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";

const ticketSchema = zod.object({
  id: zod.string().min(1, "Ticket ID is required"),
  customerId: zod.string().min(1, "Client ID is required"),
  customerName: zod.string().min(1, "Client Name is required"),
  subject: zod.string().min(5, "Subject must be at least 5 characters"),
  product: zod.string().min(1, "Product is required"),
  priority: zod.enum(["P1", "P2", "P3", "P4", "P5", "P6"]),
  status: zod.enum([
    "Open",
    "In Progress",
    "Awaiting Information",
    "Closed",
    "On Hold",
    "Resolved",
  ]),
  raisedBy: zod.string().min(1, "Raised by is required"),
  date: zod.string().min(1, "Date is required"),
  details: zod.string().min(5, "Details must be at least 5 characters"),
  myWork: zod.string().optional(),
  myNote: zod.string().optional(),
});

type TicketFormValues = zod.infer<typeof ticketSchema>;

interface TicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Ticket) => void;
  ticketToEdit?: Ticket | null;
}

const inputCls = "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-slate-50 dark:focus:bg-[#111c30] transition-all duration-200";

export function TicketForm({ isOpen, onClose, onSubmit, ticketToEdit }: TicketFormProps) {
  const { products, tickets, ticketWorkLogs, rosterMembers, username } = useNestor();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      id: ticketToEdit?.id || "",
      customerId: ticketToEdit?.customerId || "",
      customerName: ticketToEdit?.customerName || "",
      subject: ticketToEdit?.subject || "",
      product: ticketToEdit?.product || "",
      priority: ticketToEdit?.priority || "P4",
      status: ticketToEdit?.status || "Open",
      raisedBy: ticketToEdit?.raisedBy || username || "",
      date: ticketToEdit?.date || new Date().toISOString().split("T")[0],
      details: ticketToEdit?.details || "",
      myWork: ticketToEdit?.myWork || "",
      myNote: ticketToEdit?.myNote || "",
    },
  });

  const ticketId = watch("id");
  const productValue = watch("product");
  const priorityValue = watch("priority");
  const statusValue = watch("status");

  // Explicitly register custom select fields for React Hook Form validation
  useEffect(() => {
    register("product");
    register("priority");
    register("status");
  }, [register]);



  const existingTicket = (!ticketToEdit && ticketId)
    ? tickets.find((t) => t.id.trim().toLowerCase() === ticketId.trim().toLowerCase())
    : null;

  // Auto-fill form fields when an existing ticket is found
  useEffect(() => {
    if (existingTicket) {
      setValue("customerId", existingTicket.customerId, { shouldValidate: true });
      setValue("customerName", existingTicket.customerName, { shouldValidate: true });
      setValue("product", existingTicket.product, { shouldValidate: true });
      setValue("priority", existingTicket.priority, { shouldValidate: true });
      setValue("status", existingTicket.status, { shouldValidate: true });
      setValue("subject", existingTicket.subject, { shouldValidate: true });
      setValue("raisedBy", existingTicket.raisedBy, { shouldValidate: true });
      setValue("details", existingTicket.details, { shouldValidate: true });
      // Keep myWork/myNote blank — user fills in their own fresh work entry
      setValue("myWork", "", { shouldValidate: false });
      setValue("myNote", "", { shouldValidate: false });
    }
  }, [existingTicket, setValue]);

  // Work logs for the ticket being viewed/edited
  const visibleLogs: TicketWorkLog[] = (() => {
    const source = ticketToEdit ?? existingTicket;
    if (!source) return [];
    if (source.workLogs && source.workLogs.length > 0) return source.workLogs;
    return ticketWorkLogs.filter((l) => l.ticketId === source.id);
  })();

  const handleFormSubmit = (values: TicketFormValues) => {
    onSubmit({
      id: values.id,
      customerId: values.customerId,
      customerName: values.customerName,
      subject: values.subject,
      product: values.product,
      priority: values.priority as TicketPriority,
      status: values.status as TicketStatus,
      raisedBy: values.raisedBy,
      date: values.date,
      details: values.details,
      myWork: values.myWork || "",
      myNote: values.myNote || "",
      comments: ticketToEdit?.comments || [],
    });
    reset();
    onClose();
  };

  const isExistingOrEdit = !!(ticketToEdit || existingTicket);
  const submitLabel = ticketToEdit
    ? "Save Changes"
    : existingTicket
    ? "Log My Work"
    : "Create Ticket";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-[6px]"
          />

          {/* Centered Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0b0f19]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0 dark:border-white/5">
              <h3 className="text-lg font-semibold text-text-primary">
                {ticketToEdit ? `Edit Ticket ${ticketToEdit.id}` : "Add New Ticket"}
              </h3>
              <button
                onClick={onClose}
                className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 px-6 pb-6 pt-4 overflow-y-auto flex-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Ticket ID *
                  </label>
                  <input
                    {...register("id")}
                    disabled={!!ticketToEdit}
                    className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  {errors.id && (
                    <p className="mt-1 text-xs text-danger">{errors.id.message}</p>
                  )}
                  {existingTicket && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-center gap-1.5 rounded-btn border border-accent-cyan/20 bg-accent-cyan/10 px-2.5 py-1.5 text-xs text-accent-cyan shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                    >
                      <Info size={12.5} className="flex-shrink-0" />
                      <span>Existing ticket found — details auto-filled. Add your work below.</span>
                    </motion.div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Product *
                  </label>
                  <CustomSelect
                    value={productValue}
                    onChange={(val) => setValue("product", val, { shouldValidate: true })}
                    options={[
                      { value: "", label: "Select a product" },
                      ...products.map((p) => ({ value: p, label: p })),
                    ]}
                    width="w-full"
                  />
                  {errors.product && (
                    <p className="mt-1 text-xs text-danger">{errors.product.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Client ID *
                  </label>
                  <input
                    {...register("customerId")}
                    className={inputCls}
                  />
                  {errors.customerId && (
                    <p className="mt-1 text-xs text-danger">{errors.customerId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Client Name *
                  </label>
                  <input
                    {...register("customerName")}
                    className={inputCls}
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-xs text-danger">{errors.customerName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Priority *
                  </label>
                  <CustomSelect
                    value={priorityValue}
                    onChange={(val) => setValue("priority", val as any, { shouldValidate: true })}
                    options={[
                      { value: "P1", label: "P1 (Highest)" },
                      { value: "P2", label: "P2" },
                      { value: "P3", label: "P3" },
                      { value: "P4", label: "P4" },
                      { value: "P5", label: "P5" },
                      { value: "P6", label: "P6 (Lowest)" },
                    ]}
                    width="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Status *
                  </label>
                  <CustomSelect
                    value={statusValue}
                    onChange={(val) => setValue("status", val as any, { shouldValidate: true })}
                    options={[
                      { value: "Open", label: "Open" },
                      { value: "In Progress", label: "In Progress" },
                      { value: "Awaiting Information", label: "Awaiting Information" },
                      { value: "On Hold", label: "On Hold" },
                      { value: "Resolved", label: "Resolved" },
                      { value: "Closed", label: "Closed" },
                    ]}
                    width="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    {...register("date")}
                    className={inputCls}
                  />
                  {errors.date && (
                    <p className="mt-1 text-xs text-danger">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Raised By *
                  </label>
                  <input
                    {...register("raisedBy")}
                    className={inputCls}
                  />
                  {errors.raisedBy && (
                    <p className="mt-1 text-xs text-danger">{errors.raisedBy.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Subject *
                </label>
                <input
                  {...register("subject")}
                  className={inputCls}
                />
                {errors.subject && (
                  <p className="mt-1 text-xs text-danger">{errors.subject.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Details *
                </label>
                <textarea
                  {...register("details")}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
                {errors.details && (
                  <p className="mt-1 text-xs text-danger">{errors.details.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  My Work Progress {isExistingOrEdit && <span className="text-accent-cyan normal-case">(your new entry)</span>}
                </label>
                <textarea
                  {...register("myWork")}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  My Note {isExistingOrEdit && <span className="text-accent-cyan normal-case">(your new entry)</span>}
                </label>
                <textarea
                  {...register("myNote")}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Work Logs Timeline — shown when there are existing logs */}
              {visibleLogs.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-soft mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-accent-cyan" />
                    Work Log History ({visibleLogs.length} entries)
                  </p>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {visibleLogs.map((log) => (
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
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-btn bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-bold text-text-soft hover:text-text-primary transition-all duration-200 cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-btn bg-gradient-to-r from-[#ec4899] via-[#f43f5e] to-[#e11d48] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(236,72,153,0.3)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
                >
                  {submitLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
