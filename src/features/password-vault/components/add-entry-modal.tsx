"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, KeyRound, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import type { VaultField, VaultEntry } from "../types";

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string, fields: VaultField[], notes: string) => void;
  initialEntry?: VaultEntry | null;
  clientName?: string;
  productName?: string;
}

const inputCls =
  "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan transition-all";

export function AddEntryModal({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  clientName,
  productName,
}: AddEntryModalProps) {
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<VaultField[]>([]);

  useEffect(() => {
    if (initialEntry) {
      setLabel(initialEntry.label || "");
      setNotes(initialEntry.notes || "");
      setFields(initialEntry.fields ? [...initialEntry.fields] : []);
    } else {
      setLabel("");
      setNotes("");
      // Default free-form blank fields for quick start
      setFields([
        { id: `f-${Date.now()}-1`, key: "Username", value: "", isSecret: false },
        { id: `f-${Date.now()}-2`, key: "Password", value: "", isSecret: true },
      ]);
    }
  }, [initialEntry, isOpen]);

  const handleAddField = () => {
    setFields((prev) => [
      ...prev,
      { id: `f-${Date.now()}-${prev.length + 1}`, key: "", value: "", isSecret: false },
    ]);
  };

  const handleRemoveField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFieldChange = (id: string, key: string, value: string, isSecret: boolean) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, key, value, isSecret } : f)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    // Filter out completely blank key fields
    const validFields = fields.filter((f) => f.key.trim() !== "");
    onSave(label.trim(), validFields, notes.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-lg rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0c1220] light:border-slate-200 light:bg-white overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-white/5 light:border-slate-100 flex-shrink-0">
              <div>
                <div className="flex items-center gap-2 text-accent-cyan">
                  <KeyRound size={18} />
                  <h3 className="text-base font-semibold text-text-primary">
                    {initialEntry ? "Edit Credential Set" : "Add Credential Set"}
                  </h3>
                </div>
                {(clientName || productName) && (
                  <p className="text-xs text-text-soft font-mono mt-0.5">
                    {productName} {clientName ? `› ${clientName}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Credential Title / Label *
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. VPN Creds, Server Creds, DB Access"
                  className={inputCls}
                />
              </div>

              {/* Dynamic Free-Form Fields Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft">
                    Dynamic Credential Fields ({fields.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="text-xs font-bold text-accent-cyan hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Add Custom Field
                  </button>
                </div>

                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 rounded-input border p-2.5 dark:border-white/10 dark:bg-white/5 bg-slate-50 border-slate-200"
                    >
                      {/* Field Key / Label */}
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => handleFieldChange(field.id, e.target.value, field.value, field.isSecret)}
                        placeholder="Field Name (e.g. IP, Port, Pass)"
                        className="w-1/3 rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-cyan"
                      />

                      {/* Field Value */}
                      <input
                        type={field.isSecret ? "password" : "text"}
                        value={field.value}
                        onChange={(e) => handleFieldChange(field.id, field.key, e.target.value, field.isSecret)}
                        placeholder="Value"
                        className="flex-1 rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-2.5 py-1.5 text-xs text-text-primary font-mono outline-none focus:border-accent-cyan"
                      />

                      {/* Secret Toggle (Mask/Unmask) */}
                      <button
                        type="button"
                        onClick={() => handleFieldChange(field.id, field.key, field.value, !field.isSecret)}
                        className={`p-1.5 rounded transition-all cursor-pointer ${
                          field.isSecret
                            ? "bg-accent-purple/15 text-accent-purple"
                            : "text-text-soft hover:text-text-primary"
                        }`}
                        title={field.isSecret ? "Masked as secret" : "Plain text"}
                      >
                        {field.isSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      {/* Delete Field */}
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        className="p-1.5 text-text-soft hover:text-danger hover:bg-danger/10 rounded transition-colors cursor-pointer"
                        title="Remove Field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {fields.length === 0 && (
                    <p className="text-xs text-text-soft italic text-center py-4">
                      No fields added yet. Click "+ Add Custom Field" above.
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Notes / Context (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. FortiClient SSL-VPN, port 10443, requires MFA"
                  className={inputCls}
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-btn bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-text-soft hover:text-text-primary transition-all uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-5 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase"
                >
                  Save Credential Set
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
