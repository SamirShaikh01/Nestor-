"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import type { RosterMember } from "../types";

interface RosterMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputCls =
  "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-slate-50 dark:focus:bg-[#111c30] transition-all duration-200";

export function RosterMemberModal({ isOpen, onClose }: RosterMemberModalProps) {
  const { rosterMembers, addRosterMember, removeRosterMember } = useNestor();

  const [activeTab, setActiveTab] = useState<"add" | "manage">("add");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("MSS Engineer");
  const [department, setDepartment] = useState("MSS Team");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !name.trim()) return;

    addRosterMember({
      employeeId: employeeId.trim(),
      name: name.trim(),
      role: role.trim() || "MSS Engineer",
      department: department.trim() || "MSS Team",
    });

    setEmployeeId("");
    setName("");
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
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-md rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0b0f19] light:border-slate-200 light:bg-white overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-white/5 light:border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 text-accent-cyan">
                <UserPlus size={18} />
                <h3 className="text-base font-semibold text-text-primary">Manage Team Members</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b px-6 pt-3 dark:border-white/5 gap-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("add")}
                className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === "add"
                    ? "border-accent-cyan text-accent-cyan"
                    : "border-transparent text-text-soft hover:text-text-primary"
                }`}
              >
                + Add Member
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manage")}
                className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === "manage"
                    ? "border-accent-cyan text-accent-cyan"
                    : "border-transparent text-text-soft hover:text-text-primary"
                }`}
              >
                Existing Members ({rosterMembers.length})
              </button>
            </div>

            {/* Tab 1: Add Member Form */}
            {activeTab === "add" && (
              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="3894"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Samir Shaikh"
                    className={inputCls}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                      Role
                    </label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="MSS Engineer"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="MSS Team"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-btn bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-text-soft hover:text-text-primary transition-all uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-btn bg-gradient-to-r from-accent-cyan to-accent-blue px-5 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase tracking-wider"
                  >
                    Add Member
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Existing Members List (With Remove Button) */}
            {activeTab === "manage" && (
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                <p className="text-xs text-text-soft mb-2">Click remove button to delete any member from the Shift Roster.</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {rosterMembers.map((m) => (
                    <div
                      key={m.employeeId}
                      className="flex items-center justify-between rounded-input border p-3 dark:border-white/10 dark:bg-white/5 bg-slate-50 border-slate-200"
                    >
                      <div>
                        <span className="font-semibold text-text-primary text-xs block">{m.name}</span>
                        <span className="font-mono text-[10px] text-accent-cyan font-bold block">
                          ID: {m.employeeId} • {m.role || "MSS Team"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${m.name} (ID: ${m.employeeId}) from shift roster?`)) {
                            removeRosterMember(m.employeeId);
                          }
                        }}
                        className="rounded-btn bg-danger/10 text-danger hover:bg-danger hover:text-white px-3 py-1.5 text-xs font-bold transition-all uppercase flex items-center gap-1"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {rosterMembers.length === 0 && (
                    <p className="text-xs text-text-soft italic text-center py-6">No roster members configured.</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
