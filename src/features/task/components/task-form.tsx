"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import type { Task, TaskCategory } from "../types";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import { useEffect as ReactUseEffect } from "react";

const taskSchema = zod.object({
  title: zod.string().min(3, "Title must be at least 3 characters"),
  description: zod.string().optional(),
  category: zod.string().min(1, "Category is required"),
  status: zod.enum(["pending", "in-progress", "completed"]),
  tagsInput: zod.string().optional(),
  notes: zod.string().optional(),
  date: zod.string().min(1, "Date is required"),
});

type TaskFormValues = zod.infer<typeof taskSchema>;

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Task, "id">) => void;
  taskToEdit?: Task | null;
}

const inputCls = "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-slate-50 dark:focus:bg-[#111c30] transition-all duration-200";

export function TaskForm({ isOpen, onClose, onSubmit, taskToEdit }: TaskFormProps) {
  const { categories } = useNestor();
  const [sessions, setSessions] = useState<string[]>(taskToEdit?.sessions || []);
  const [newSession, setNewSession] = useState("");

  const defaultCategory = taskToEdit?.category || categories[0] || "Operations";

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: taskToEdit?.title || "",
      description: taskToEdit?.description || "",
      category: defaultCategory,
      status: taskToEdit?.status || "pending",
      tagsInput: taskToEdit?.tags.join(", ") || "",
      notes: taskToEdit?.notes || "",
      date: taskToEdit?.date || new Date().toISOString().split("T")[0],
    },
  });

  // Explicitly register custom select fields for React Hook Form validation
  ReactUseEffect(() => {
    register("category");
    register("status");
  }, [register]);

  const categoryValue = watch("category");
  const statusValue = watch("status");

  const handleFormSubmit = (values: TaskFormValues) => {
    const tags = values.tagsInput
      ? values.tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    // Auto-calculate duration from sessions list
    let durationMinutes = taskToEdit?.durationMinutes || 0;
    if (sessions.length > 0) {
      durationMinutes = sessions.reduce((total, session) => {
        try {
          const [start, end] = session.split("-");
          if (start && end) {
            const [startH, startM] = start.split(":").map(Number);
            const [endH, endM] = end.split(":").map(Number);
            let diff = (endH * 60 + endM) - (startH * 60 + startM);
            if (diff < 0) diff += 24 * 60; // handle midnight wrap
            return total + diff;
          }
        } catch {
          // ignore parsing errors
        }
        return total;
      }, 0);
    }

    onSubmit({
      title: values.title,
      description: values.description || "",
      category: values.category as TaskCategory,
      status: values.status,
      durationMinutes,
      tags,
      date: values.date,
      notes: values.notes || "",
      sessions,
    });
    reset();
    setSessions([]);
    onClose();
  };

  const addSessionBlock = () => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(newSession)) {
      setSessions([...sessions, newSession]);
      setNewSession("");
    } else {
      alert("Invalid session format. Use HH:MM-HH:MM (e.g. 09:00-10:15)");
    }
  };

  const removeSessionBlock = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
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
                {taskToEdit ? "Edit Task" : "Add New Task"}
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
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Task Title *
                </label>
                <input
                  {...register("title")}
                  className={inputCls}
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-danger">{errors.title.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Category *
                  </label>
                  <CustomSelect
                    value={categoryValue}
                    onChange={(val) => setValue("category", val as any)}
                    options={categories.map((cat) => ({ value: cat, label: cat }))}
                    width="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Status *
                  </label>
                  <CustomSelect
                    value={statusValue}
                    onChange={(val) => setValue("status", val as any)}
                    options={[
                      { value: "pending", label: "Pending" },
                      { value: "in-progress", label: "In Progress" },
                      { value: "completed", label: "Completed" },
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
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Tags (comma separated)
                  </label>
                  <input
                    {...register("tagsInput")}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Task Description
                </label>
                <textarea
                  {...register("description")}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Task Notes
                </label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Sessions List */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft">
                  Work Sessions
                </label>
                
                {/* Manual session builder */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSession}
                    onChange={(e) => setNewSession(e.target.value)}
                    className="flex-1 rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan"
                  />
                  <button
                    type="button"
                    onClick={addSessionBlock}
                    className="rounded-btn bg-accent-cyan/10 border border-accent-cyan/20 hover:bg-accent-cyan/20 px-3 text-xs font-medium text-accent-cyan transition-colors"
                  >
                    + Add Session
                  </button>
                </div>

                {sessions.length > 0 && (
                  <ul className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {sessions.map((session, idx) => (
                      <li key={idx} className="flex items-center justify-between rounded-input border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-text-muted">
                        <span className="font-mono">{session}</span>
                        <button
                          type="button"
                          onClick={() => removeSessionBlock(idx)}
                          className="text-danger hover:text-danger-light font-medium"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

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
                  className="rounded-btn bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
                >
                  Save Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
