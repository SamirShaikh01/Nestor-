"use client";

import { motion } from "framer-motion";
import { Clock3, Search, Play, Pause, Square, Trash2, Edit } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { TaskForm } from "./task-form";
import type { Task, TaskStatus } from "@/src/features/task/types";
import { getCategoryColorBadge } from "@/src/shared/lib/theme-utils";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";

const statuses: Array<TaskStatus | "all"> = ["all", "pending", "in-progress", "completed"];

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

interface TaskModuleProps {
  selectedTaskId?: number | null;
  onSelectTask?: (id: number | null) => void;
}

export function TaskModule({ selectedTaskId: propSelectedTaskId, onSelectTask }: TaskModuleProps = {}) {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    activeTimers,
    startTimer,
    pauseTimer,
    stopTimer,
    loadingTasks,
    categories,
  } = useNestor();

  // Search & Filter states
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [category, setCategory] = useState<string>("all");
  
  // Date Filter states
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStart, setCustomStart] = useState("2026-07-01");
  const [customEnd, setCustomEnd] = useState("2026-07-12");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Selection & Modal States
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(propSelectedTaskId ?? null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (propSelectedTaskId !== undefined && propSelectedTaskId !== null) {
      setSelectedTaskId(propSelectedTaskId);
    }
  }, [propSelectedTaskId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setTaskToEdit(null);
  };

  const handleSelectTask = (id: number | null) => {
    setSelectedTaskId(id);
    onSelectTask?.(id);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search by Task Name (Title)
      const matchesSearch =
        search.length === 0 ||
        task.title.toLowerCase().includes(search.toLowerCase());

      // 2. Status Filter
      const matchesStatus = status === "all" || task.status === status;

      // 3. Category Filter
      const matchesCategory = category === "all" || task.category === category;

      // 4. Date Filter
      const matchesDate = (() => {
        if (dateFilter === "all") return true;
        
        const d = new Date();
        const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        
        if (dateFilter === "today") {
          return task.date === todayStr;
        }
        if (dateFilter === "week") {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const startStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const endStr = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, "0")}-${String(endOfWeek.getDate()).padStart(2, "0")}`;
          
          return task.date >= startStr && task.date <= endStr;
        }
        if (dateFilter === "month") {
          const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
          return task.date.startsWith(currentMonthStr);
        }
        if (dateFilter === "custom") {
          return task.date >= customStart && task.date <= customEnd;
        }
        return true;
      })();

      return matchesSearch && matchesStatus && matchesCategory && matchesDate;
    });
  }, [category, search, status, dateFilter, customStart, customEnd, tasks]);

  // Paginated List (20 items max)
  const totalPages = Math.ceil(filteredTasks.length / 20);
  const paginatedTasks = useMemo(() => {
    return filteredTasks.slice((currentPage - 1) * 20, currentPage * 20);
  }, [filteredTasks, currentPage]);

  // Set default selected task on load if not set
  const selectedTask = useMemo(() => {
    if (selectedTaskId !== null) {
      const found = tasks.find((task) => task.id === selectedTaskId);
      if (found) return found;
    }
    return paginatedTasks[0] ?? null;
  }, [selectedTaskId, paginatedTasks, tasks]);

  const handleCreateTask = async (data: Omit<Task, "id">) => {
    await addTask(data);
  };

  const handleEditTask = async (data: Omit<Task, "id">) => {
    if (taskToEdit) {
      await updateTask({
        ...data,
        id: taskToEdit.id,
      });
      setTaskToEdit(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(id);
      if (selectedTaskId === id) {
        handleSelectTask(null);
      }
    }
  };

  const openAddModal = () => {
    setTaskToEdit(null);
    setIsFormOpen(true);
  };

  const openEditModal = (task: Task) => {
    setTaskToEdit(task);
    setIsFormOpen(true);
  };

  if (loadingTasks) {
    return (
      <div className="flex h-64 items-center justify-center text-text-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
        <span className="ml-3">Loading tasks...</span>
      </div>
    );
  }


  const renderTaskDetail = (task: Task) => (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-badge px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getCategoryColorBadge(task.category)}`}>
            {task.category}
          </span>
          <h3 className="text-xl font-semibold text-text-primary mt-1">{task.title}</h3>
          <p className="text-xs text-text-muted mt-1">Date: {task.date}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full border border-success/30 bg-success/10 px-3.5 py-1 text-sm font-semibold text-success shadow-sm">
            {formatMinutes(task.durationMinutes)}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-badge uppercase ${
              task.status === "completed"
                ? "bg-success/20 text-success"
                : task.status === "in-progress"
                ? "bg-accent-cyan/20 text-accent-cyan"
                : "bg-white/5 text-text-muted"
            }`}
          >
            {task.status}
          </span>
        </div>
      </div>

      {task.description && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1">Description</p>
          <p className="text-sm leading-6 text-text-muted">{task.description}</p>
        </div>
      )}

      <div className="rounded-input border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Session Timer</span>
          {activeTimers[task.id] ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-danger font-medium animate-pulse">
              <span className="h-2 w-2 rounded-full bg-danger"></span>
              Tracking since {activeTimers[task.id]}
            </span>
          ) : (
            <span className="text-xs text-text-muted">Timer idle</span>
          )}
        </div>

        <div className="flex gap-2">
          {task.status !== "completed" ? (
            activeTimers[task.id] ? (
              <>
                <button
                  onClick={() => pauseTimer(task.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-btn bg-warning/20 border border-warning/45 hover:bg-warning/30 py-2.5 text-sm font-medium text-warning transition-colors"
                >
                  <Pause size={14} /> Pause Timer
                </button>
                <button
                  onClick={() => stopTimer(task.id)}
                  className="inline-flex items-center justify-center rounded-btn bg-success/20 border border-success/45 hover:bg-success/30 px-4 py-2.5 text-sm font-medium text-success transition-colors"
                  title="Finish Task"
                >
                  <Square size={14} fill="currentColor" /> Stop
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startTimer(task.id)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-btn bg-accent-cyan/20 border border-accent-cyan/45 hover:bg-accent-cyan/30 py-2.5 text-sm font-medium text-accent-cyan transition-colors"
                >
                  <Play size={14} fill="currentColor" /> Start Timer
                </button>
                <button
                  onClick={() => stopTimer(task.id)}
                  className="inline-flex items-center justify-center rounded-btn bg-success/20 border border-success/45 hover:bg-success/30 px-3 py-2.5 text-sm font-medium text-success transition-colors"
                >
                  Complete
                </button>
              </>
            )
          ) : (
            <div className="w-full text-center text-xs text-success bg-success/10 border border-success/20 py-2 rounded-btn font-medium">
              ✓ Task Completed
            </div>
          )}
        </div>
      </div>

      {task.notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1">Notes</p>
          <p className="text-sm leading-6 text-text-muted bg-white/5 p-3 rounded-input border border-white/5 font-mono text-xs whitespace-pre-line">
            {task.notes}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-2">Logged Sessions</p>
        {task.sessions && task.sessions.length > 0 ? (
          <ul className="space-y-2">
            {task.sessions.map((session, idx) => (
              <li key={idx} className="rounded-input border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-muted">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock3 size={14} className="text-text-soft" />
                    <span className="font-mono">{session}</span>
                  </div>
                  <span className="text-xs text-text-soft">
                    Session {idx + 1}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-soft italic">No sessions logged yet. Use the timer or edit manually.</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
        <button
          onClick={() => openEditModal(task)}
          className="inline-flex items-center gap-2 rounded-btn bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/20 px-4 py-2.5 text-xs font-semibold text-accent-cyan transition-colors"
        >
          <Edit size={14} /> Edit Task
        </button>
        <button
          onClick={() => handleDelete(task.id)}
          className="inline-flex items-center gap-2 rounded-btn bg-danger/10 hover:bg-danger/20 border border-danger/20 px-4 py-2.5 text-xs font-semibold text-danger transition-colors"
        >
          <Trash2 size={14} /> Delete Task
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Task Header with Inline Date Filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft md:flex-row md:items-center md:justify-between relative z-40 dark:border-white/5 dark:bg-white/5"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">Task Log</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Structured daily work</h2>
        </div>

        {/* Date Filter & Add Task controls */}
        <div className="flex flex-wrap items-center gap-3 relative z-30">
          {/* Date Filter dropdown */}
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
            className="rounded-btn bg-gradient-to-r from-[#8b5cf6] to-[#a855f7] px-5 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:scale-105 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer uppercase tracking-wider"
          >
            + Add Task
          </button>
        </div>
      </motion.div>

      {/* Filter Inputs Toolbar */}
      <div className="grid gap-4 rounded-card border p-4 shadow-soft backdrop-blur-[18px] md:grid-cols-[1.2fr_0.8fr_0.8fr] relative z-30 dark:border-white/5 dark:bg-card-bg">
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Search</span>
          <div className="flex items-center gap-2 rounded-input border px-3 py-2 transition-colors focus-within:border-accent-cyan focus-within:shadow-[0_0_20px_rgba(34,211,238,.25)] dark:border-white/10 dark:bg-white/5">
            <Search size={16} strokeWidth={1.75} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }}
              placeholder="Search by Task Name"
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
              label: option === "all" ? "All statuses" : option,
            }))}
            width="w-full"
          />
        </label>
        <label className="text-sm text-text-muted">
          <span className="mb-2 block font-medium text-text-secondary">Category</span>
          <CustomSelect
            value={category}
            onChange={(val) => { setCategory(val); setCurrentPage(1); }}
            options={["all", ...categories].map((option) => ({
              value: option,
              label: option === "all" ? "All categories" : option,
            }))}
            width="w-full"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left Side List with Pagination */}
        <div className="space-y-3">
          {paginatedTasks.map((task) => {
            const isSelected = selectedTask?.id === task.id;
            const isTracking = activeTimers[task.id] !== undefined;

            return (
              <div
                key={task.id}
                className={`relative overflow-hidden rounded-card border transition-all duration-300 ease-in-out ${
                  isSelected
                    ? "border-accent-purple/40 bg-card-bg shadow-[0_0_15px_rgba(168,85,247,0.25)] z-10"
                    : "border-white/5 bg-card-bg shadow-soft hover:-translate-y-1 hover:border-accent-purple/30 hover:bg-accent-purple/5 dark:hover:bg-accent-purple/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectTask(task.id)}
                  className="w-full p-4 text-left select-none outline-none"
                >
                  {/* Active Tracking Indicator Overlay Line */}
                  {isTracking && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-danger to-accent-purple animate-pulse" />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-text-primary">{task.title}</p>
                        {isTracking && (
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-1">
                        <span className={`rounded-badge px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getCategoryColorBadge(task.category)}`}>
                          {task.category}
                        </span>
                        <span className={`text-xs ${isSelected ? "text-text-muted" : "text-text-soft"}`}>
                          {task.date}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-badge px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${
                        task.status === "completed"
                          ? "bg-success/20 text-success border border-success/30"
                          : task.status === "in-progress"
                          ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                          : "bg-[#0f172a]/4 dark:bg-white/5 text-text-muted border border-white/10"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`rounded-badge px-2.5 py-1 text-xs ${
                            isSelected ? "bg-white/10 text-text-primary" : "bg-[#0f172a]/4 dark:bg-white/5 text-text-soft"
                          }`}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-text-muted flex items-center gap-1 font-medium">
                      <Clock3 size={12} /> {formatMinutes(task.durationMinutes)}
                    </span>
                  </div>
                </button>
                {/* Mobile Inline Detail View */}
                {isSelected && (
                  <div className="block lg:hidden border-t border-white/10 bg-black/10 dark:bg-white/5 p-4 animate-in slide-in-from-top-2">
                    {renderTaskDetail(task)}
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredTasks.length === 0 && (
            <div className="rounded-card border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-text-muted">
              No tasks match the current filters yet.
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
                Page {currentPage} of {totalPages} ({filteredTasks.length} tasks)
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

        {/* Right Side Detail Sidebar (Desktop Only) */}
        <div className="hidden lg:block rounded-card border border-white/5 bg-card-bg p-5 shadow-soft backdrop-blur-[18px] self-start">
          {selectedTask ? renderTaskDetail(selectedTask) : (
            <p className="text-sm text-text-muted text-center py-8">Select a task to see its detail view.</p>
          )}
        </div>
      </div>

      {/* Task Modal Form */}
      <TaskForm
        key={taskToEdit ? `edit-${taskToEdit.id}` : "new"}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={taskToEdit ? handleEditTask : handleCreateTask}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}
