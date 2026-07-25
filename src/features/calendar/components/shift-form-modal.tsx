import { useState, useEffect } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { X, Calendar, ClipboardList, Ticket, Clock, Trash2, Save, Send, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import { TimePicker } from "@/src/shared/components/ui/time-picker";
import { isSupabaseConfigured } from "@/src/shared/lib/supabase";

interface ShiftFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function parseTiming(range: string): { inTime: string; outTime: string } {
  const lower = range.toLowerCase().replace(/\s+/g, "");
  if (lower.includes("7am") && lower.includes("4pm")) return { inTime: "07:00", outTime: "16:00" };
  if (lower.includes("10am") && lower.includes("7pm")) return { inTime: "10:00", outTime: "19:00" };
  if (lower.includes("1pm") && lower.includes("10pm")) return { inTime: "13:00", outTime: "22:00" };
  if (lower.includes("10pm") && lower.includes("7am")) return { inTime: "22:00", outTime: "07:00" };
  return { inTime: "", outTime: "" };
}

export function ShiftFormModal({ isOpen, onClose, selectedDate }: ShiftFormModalProps) {
  const {
    tasks,
    tickets,
    shiftsRegistry,
    shiftAssignments,
    assignShift,
    rosterAssignments,
    shiftPresets,
    assignRosterShift,
    role,
    employeeId,
    submitShiftRequest,
  } = useNestor();

  // Load relevant date items
  const dayTasks = tasks.filter((t) => t.date === selectedDate);
  const dayTickets = tickets.filter((t) => t.date === selectedDate);

  // Resolve initial values from Roster
  let initialShiftName = "";
  let initialInTime = "";
  let initialOutTime = "";

  if (isSupabaseConfigured && employeeId) {
    const code = rosterAssignments[`${employeeId}_${selectedDate}`];
    if (code) {
      if (code === "WO") {
        initialShiftName = "Week Off";
      } else if (code === "L") {
        initialShiftName = "Leave";
      } else {
        const preset = shiftPresets.find((p) => p.code === code);
        if (preset) {
          initialShiftName = preset.name;
          const timing = parseTiming(preset.timeRange);
          initialInTime = timing.inTime;
          initialOutTime = timing.outTime;
        }
      }
    }
  } else {
    const existingAssignment = shiftAssignments[selectedDate];
    if (existingAssignment) {
      initialShiftName = existingAssignment.shiftName;
      initialInTime = existingAssignment.inTime;
      initialOutTime = existingAssignment.outTime;
    }
  }

  // Shift form states
  const [shiftName, setShiftName] = useState(initialShiftName);
  const [inTime, setInTime] = useState(initialInTime);
  const [outTime, setOutTime] = useState(initialOutTime);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const handleShiftNameChange = (val: string) => {
    setShiftName(val);
    if (val === "Leave" || val === "Week Off") {
      setInTime("");
      setOutTime("");
    } else {
      const matched = shiftPresets.find((s) => s.name === val);
      if (matched) {
        const parsed = parseTiming(matched.timeRange);
        setInTime(parsed.inTime);
        setOutTime(parsed.outTime);
      } else {
        const matchedLocal = shiftsRegistry.find((s) => s.name === val);
        if (matchedLocal) {
          const parsed = parseTiming(matchedLocal.timeRange);
          setInTime(parsed.inTime);
          setOutTime(parsed.outTime);
        }
      }
    }
  };

  const handleSave = async () => {
    if (!shiftName) {
      alert("Please select a shift.");
      return;
    }

    // Identify requested code
    let requestedCode = "";
    if (shiftName === "Week Off") {
      requestedCode = "WO";
    } else if (shiftName === "Leave") {
      requestedCode = "L";
    } else {
      const preset = shiftPresets.find((p) => p.name === shiftName);
      requestedCode = preset ? preset.code : "S1"; // default fallback
    }

    if (isSupabaseConfigured && employeeId) {
      if (role === "admin") {
        // Admins update directly
        await assignRosterShift(employeeId, selectedDate, requestedCode);
        onClose();
      } else {
        // Members submit change request
        if (!reason.trim()) {
          alert("Please provide a reason for the shift change request.");
          return;
        }
        await submitShiftRequest(selectedDate, requestedCode, reason.trim());
        setRequestSubmitted(true);
      }
    } else {
      assignShift(selectedDate, {
        shiftName,
        inTime,
        outTime,
        note,
      });
      onClose();
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this shift assignment?")) {
      if (isSupabaseConfigured && employeeId) {
        if (role === "admin") {
          await assignRosterShift(employeeId, selectedDate, "WO"); // delete falls back to Week Off
          onClose();
        } else {
          // Member requests off
          await submitShiftRequest(selectedDate, "WO", "Requested shift removal / Week Off");
          setRequestSubmitted(true);
        }
      } else {
        assignShift(selectedDate, null);
        onClose();
      }
    }
  };

  const formattedDate = () => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return selectedDate;
    }
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
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Large Multi-column Modal panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden rounded-card border shadow-soft dark:border-white/10 dark:bg-sidebar-bg"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-2.5 text-text-primary">
                <Calendar className="text-accent-cyan" size={20} />
                <div>
                  <h3 className="text-lg font-semibold">Shift planner & daily activity summary</h3>
                  <p className="text-xs text-text-soft">{formattedDate()}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content: Three-pane side-by-side layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto flex-1 dark:bg-[#0b1020]/45">
              
              {/* Column 1: Daily Tasks */}
              <div className="rounded-card border border-white/5 bg-card-bg/60 p-5 space-y-4 flex flex-col max-h-[60vh]">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <ClipboardList size={16} className="text-accent-purple" />
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Tasks of this day</h4>
                  <span className="ml-auto rounded-badge bg-accent-purple/10 px-2 py-0.5 text-xs text-accent-purple font-mono">
                    {dayTasks.length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {dayTasks.map((t) => (
                    <div key={t.id} className="rounded-input border border-white/5 bg-white/5 p-3 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-text-primary leading-tight">{t.title}</span>
                        <span className={`capitalize rounded-badge px-2 py-0.5 text-[10px] font-medium ${
                          t.status === "completed" ? "bg-success/15 text-success" : 
                          t.status === "in-progress" ? "bg-accent-cyan/15 text-accent-cyan" : 
                          "bg-text-soft/10 text-text-soft"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-text-soft font-medium">
                        <span>{t.category}</span>
                        <span className="font-mono">{formatMinutes(t.durationMinutes)}</span>
                      </div>
                    </div>
                  ))}

                  {dayTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-text-soft py-10">
                      <ClipboardList size={28} className="opacity-20 mb-2" />
                      <p className="text-xs italic">No tasks logged on this day</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Shift Manager Form */}
              <div className="rounded-card border border-white/5 bg-card-bg/60 p-5 space-y-4 flex flex-col max-h-[60vh] justify-between">
                {requestSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center text-center py-10 flex-1 space-y-4"
                  >
                    <CheckCircle className="text-success" size={48} />
                    <div>
                      <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Request Submitted</h4>
                      <p className="text-xs text-text-soft mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                        Your shift change request has been logged. An administrator will review and approve it shortly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-btn border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-text-primary hover:bg-white/10 cursor-pointer"
                    >
                      Close Window
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                        <Clock size={16} className="text-accent-cyan" />
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
                          {isSupabaseConfigured && role !== "admin" ? "Request Shift Change" : "Shift Configuration"}
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {/* Shift Dropdown */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                            Select shift *
                          </label>
                          <CustomSelect
                            value={shiftName}
                            onChange={handleShiftNameChange}
                            options={[
                              { value: "", label: "-- Choose Shift --" },
                              ...shiftPresets
                                .filter((s) => s.name !== "Week Off" && s.name !== "Leave" && s.code !== "WO" && s.code !== "L")
                                .map((s) => ({ value: s.name, label: `${s.name} (${s.timeRange})` })),
                              { value: "Week Off", label: "Week Off (Holiday)" },
                              { value: "Leave", label: "Leave (Vacation)" },
                            ]}
                            width="w-full"
                          />
                        </div>

                        {/* Time Inputs */}
                        {shiftName !== "Leave" && shiftName !== "Week Off" && shiftName !== "" && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                                Office In-Time
                              </label>
                              <div className="rounded-input border px-3 py-2 text-xs font-mono text-text-muted bg-white/5 border-white/10">
                                {inTime || "00:00"}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                                Office Out-Time
                              </label>
                              <div className="rounded-input border px-3 py-2 text-xs font-mono text-text-muted bg-white/5 border-white/10">
                                {outTime || "00:00"}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Note / Reason Field */}
                        {isSupabaseConfigured && role !== "admin" ? (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                              Reason for change request *
                            </label>
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              rows={4}
                              placeholder="Describe your emergency or shift swap reason..."
                              className="w-full rounded-input border px-3.5 py-2 text-sm text-text-primary outline-none focus:border-accent-cyan resize-none dark:border-white/10 dark:bg-[#0b1020]"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                              Shift/Duty notes
                            </label>
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={4}
                              placeholder="Log handovers, duty highlights, or shift changes..."
                              className="w-full rounded-input border px-3.5 py-2 text-sm text-text-primary outline-none focus:border-accent-cyan resize-none dark:border-white/10 dark:bg-[#0b1020]"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-4 border-t border-white/5">
                      {isSupabaseConfigured && role !== "admin" ? (
                        <button
                          type="button"
                          onClick={handleSave}
                          className="flex-1 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-2.5 text-xs font-bold text-text-primary shadow-glow flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                        >
                          <Send size={13} /> Send Request
                        </button>
                      ) : (
                        <>
                          {(initialShiftName) && (
                            <button
                              type="button"
                              onClick={handleDelete}
                              className="rounded-btn border border-danger/20 bg-danger/5 hover:bg-danger/10 p-2 text-xs font-medium text-danger transition-colors flex items-center justify-center gap-1.5"
                              title="Delete assignment"
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSave}
                            className="flex-1 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-2.5 text-xs font-semibold text-text-primary shadow-glow flex items-center justify-center gap-1.5"
                          >
                            <Save size={15} /> Save Shift Plan
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Column 3: Daily Tickets */}
              <div className="rounded-card border border-white/5 bg-card-bg/60 p-5 space-y-4 flex flex-col max-h-[60vh]">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <Ticket size={16} className="text-accent-cyan" />
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Tickets of this day</h4>
                  <span className="ml-auto rounded-badge bg-accent-cyan/10 px-2 py-0.5 text-xs text-accent-cyan font-mono">
                    {dayTickets.length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                  {dayTickets.map((t) => (
                    <div key={t.id} className="rounded-input border border-white/5 bg-white/5 p-3 text-xs space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-text-primary leading-tight">{t.id}: {t.subject}</span>
                        <span className={`rounded-badge px-2 py-0.5 text-[10px] font-semibold ${
                          t.priority === "P1" ? "bg-danger/15 text-danger" : 
                          t.priority === "P2" ? "bg-amber-500/15 text-amber-500" :
                          "bg-text-soft/10 text-text-soft"
                        }`}>
                          {t.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-text-soft font-medium">
                        <span>{t.product}</span>
                        <span>{t.status}</span>
                      </div>
                    </div>
                  ))}

                  {dayTickets.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-text-soft py-10">
                      <Ticket size={28} className="opacity-20 mb-2" />
                      <p className="text-xs italic">No tickets logged on this day</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
