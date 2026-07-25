"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import type { OemCase } from "../types";

interface OemCaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<OemCase, "id" | "agingDays">) => void;
  caseToEdit?: OemCase | null;
}

interface OemCaseFormData {
  productName: string;
  productCategory: string;
  clientId: string;
  clientName: string;
  caseType: string;
  oemCaseId: string;
  internalTicketId: string;
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  assignedTo: string;
  raisedBy: string;
  createdDate: string;
  updatedDate: string;
  statusUpdate: string;
  closureDate: string;
  notes: string;
}

const inputCls =
  "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-slate-50 dark:focus:bg-[#111c30] transition-all duration-200";

export function OemCaseForm({ isOpen, onClose, onSubmit, caseToEdit }: OemCaseFormProps) {
  const {
    products,
    productCategories,
    caseTypes,
    statusUpdates,
    rosterMembers,
    username,
  } = useNestor();

  // Real usernames from DB profiles
  const memberOptions = rosterMembers.length > 0
    ? rosterMembers.map((m) => ({ value: m.name, label: m.name }))
    : [{ value: username || "Me", label: username || "Me" }];

  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<OemCaseFormData>({
    defaultValues: {
      productName: products[0] || "",
      productCategory: productCategories[0] || "",
      clientId: "",
      clientName: "",
      caseType: caseTypes[0] || "Issue",
      oemCaseId: "",
      internalTicketId: "",
      title: "",
      description: "",
      priority: "P4",
      assignedTo: username || rosterMembers[0]?.name || "",
      raisedBy: username || rosterMembers[0]?.name || "",
      createdDate: getTodayStr(),
      updatedDate: getTodayStr(),
      statusUpdate: statusUpdates[0] || "Pending From OEM",
      closureDate: "",
      notes: "",
    },
  });

  const productNameValue = watch("productName");
  const productCategoryValue = watch("productCategory");
  const caseTypeValue = watch("caseType");
  const priorityValue = watch("priority");
  const assignedToValue = watch("assignedTo");
  const raisedByValue = watch("raisedBy");
  const statusUpdateValue = watch("statusUpdate");

  useEffect(() => {
    if (caseToEdit) {
      reset({
        productName: caseToEdit.productName || products[0] || "",
        productCategory: caseToEdit.productCategory || productCategories[0] || "",
        clientId: caseToEdit.clientId || "",
        clientName: caseToEdit.clientName || "",
        caseType: caseToEdit.caseType || caseTypes[0] || "",
        oemCaseId: caseToEdit.oemCaseId || "",
        internalTicketId: caseToEdit.internalTicketId || "",
        title: caseToEdit.title || "",
        description: caseToEdit.description || "",
        priority: caseToEdit.priority || "P3",
        assignedTo: caseToEdit.assignedTo || username,
        raisedBy: caseToEdit.raisedBy || username,
        createdDate: caseToEdit.createdDate || getTodayStr(),
        updatedDate: caseToEdit.updatedDate || getTodayStr(),
        statusUpdate: caseToEdit.statusUpdate || statusUpdates[0] || "",
        closureDate: caseToEdit.closureDate || "",
        notes: caseToEdit.notes || "",
      });
    } else {
      reset({
        productName: products[0] || "",
        productCategory: productCategories[0] || "",
        clientId: "",
        clientName: "",
        caseType: caseTypes[0] || "Issue",
        oemCaseId: "",
        internalTicketId: "",
        title: "",
        description: "",
        priority: "P4",
        assignedTo: username || rosterMembers[0]?.name || "",
        raisedBy: username || rosterMembers[0]?.name || "",
        createdDate: getTodayStr(),
        updatedDate: getTodayStr(),
        statusUpdate: statusUpdates[0] || "Pending From OEM",
        closureDate: "",
        notes: "",
      });
    }
  }, [caseToEdit, reset, products, productCategories, caseTypes, statusUpdates, rosterMembers, username]);

  const handleFormSubmit = (data: OemCaseFormData) => {
    onSubmit({
      ...data,
      closureDate: data.closureDate || null,
    });
    onClose();
  };

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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Centered Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0b0f19] light:border-slate-200 light:bg-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0 dark:border-white/5 light:border-slate-100">
              <h3 className="text-lg font-semibold text-text-primary">
                {caseToEdit ? `Edit OEM Case ${caseToEdit.oemCaseId || caseToEdit.id}` : "Log New OEM Case"}
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
              
              {/* Row 1: Product Name & Category */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Product Name *
                  </label>
                  <CustomSelect
                    value={productNameValue}
                    onChange={(val) => setValue("productName", val)}
                    options={products.map((p) => ({ value: p, label: p }))}
                    width="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Product Category *
                  </label>
                  <CustomSelect
                    value={productCategoryValue}
                    onChange={(val) => setValue("productCategory", val)}
                    options={productCategories.map((c) => ({ value: c, label: c }))}
                    width="w-full"
                  />
                </div>
              </div>

              {/* Row 2: Client ID & Client Name */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Client ID
                  </label>
                  <input
                    {...register("clientId")}
                    placeholder=""
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Client Name
                  </label>
                  <input
                    {...register("clientName")}
                    placeholder=""
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 3: Case Type, OEM Case ID, Internal Ticket ID */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Case Type *
                  </label>
                  <CustomSelect
                    value={caseTypeValue}
                    onChange={(val) => setValue("caseType", val)}
                    options={caseTypes.map((t) => ({ value: t, label: t }))}
                    width="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    OEM Case ID *
                  </label>
                  <input
                    {...register("oemCaseId", { required: "OEM Case ID is required" })}
                    className={inputCls}
                  />
                  {errors.oemCaseId && (
                    <p className="mt-1 text-xs text-danger">{errors.oemCaseId.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Internal Ticket ID
                  </label>
                  <input
                    {...register("internalTicketId")}
                    placeholder=""
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 4: Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Case Title / Subject *
                </label>
                <input
                  {...register("title", { required: "Case Title is required" })}
                  placeholder="Request global hash block on Trellix console"
                  className={inputCls}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-danger">{errors.title.message}</p>
                )}
              </div>

              {/* Row 5: Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={2}
                  placeholder="Detailed breakdown of OEM issue or feature request..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Row 6: Priority, Assigned To, Raised By */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Priority *
                  </label>
                  <CustomSelect
                    value={priorityValue}
                    onChange={(val) => setValue("priority", val as any)}
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
                    Assigned To
                  </label>
                  <CustomSelect
                    value={assignedToValue}
                    onChange={(val) => setValue("assignedTo", val)}
                    options={memberOptions}
                    width="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Raised By
                  </label>
                  <CustomSelect
                    value={raisedByValue}
                    onChange={(val) => setValue("raisedBy", val)}
                    options={memberOptions}
                    width="w-full"
                  />
                </div>
              </div>

              {/* Row 7: Dates (Created, Last Updated, Closure) */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Created Date *
                  </label>
                  <input
                    type="date"
                    {...register("createdDate")}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Last Updated Date
                  </label>
                  <input
                    type="date"
                    {...register("updatedDate")}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Closure Date (Optional)
                  </label>
                  <input
                    type="date"
                    {...register("closureDate")}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 8: Status Update */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Last Update Received (Status) *
                </label>
                <CustomSelect
                  value={statusUpdateValue}
                  onChange={(val) => setValue("statusUpdate", val)}
                  options={statusUpdates.map((s) => ({ value: s, label: s }))}
                  width="w-full"
                />
              </div>

              {/* Row 9: Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  placeholder="Additional observations, vendor engineer contact details..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Actions */}
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
                  className="rounded-btn bg-gradient-to-r from-accent-cyan to-accent-blue px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(6,182,212,0.3)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
                >
                  {caseToEdit ? "Save Changes" : "Create OEM Case"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
