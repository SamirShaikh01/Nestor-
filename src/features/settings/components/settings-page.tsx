"use client";

import { useState } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import { Plus, Trash2, Shield, Settings2, User, Check, ChevronDown, ChevronUp, FolderKanban, CalendarDays, Paintbrush, Mail, Briefcase, FileCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TimePicker } from "@/src/shared/components/ui/time-picker";
import { supabase, isSupabaseConfigured } from "@/src/shared/lib/supabase";

function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const minFormatted = min > 0 ? `:${String(min).padStart(2, "0")}` : "";
  return `${hour12}${minFormatted} ${ampm}`;
}

// Parse a timeRange string like "7 AM to 4 PM" into {from: "07:00", to: "16:00"}
function parseTimeRange(timeRange: string): { from: string; to: string } {
  const empty = { from: "", to: "" };
  if (!timeRange) return empty;
  // Try "HH:MM to HH:MM" format first
  const colonMatch = timeRange.match(/(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})/);
  if (colonMatch) return { from: colonMatch[1].padStart(5, "0"), to: colonMatch[2].padStart(5, "0") };
  // Try "H AM to H PM" format
  const ampmMatch = timeRange.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM)\s+to\s+(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i);
  if (!ampmMatch) return empty;
  const toHH = (h: string, meridiem: string) => {
    let [hr, mn = "0"] = h.split(":");
    let hours = parseInt(hr, 10);
    if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(parseInt(mn, 10)).padStart(2, "0")}`;
  };
  return { from: toHH(ampmMatch[1], ampmMatch[2]), to: toHH(ampmMatch[3], ampmMatch[4]) };
}

const inputCls = "flex-1 rounded-input border px-3.5 py-2 text-sm text-text-primary outline-none focus:border-accent-cyan transition-colors border-slate-200 dark:border-white/10 bg-white dark:bg-white/5";
const timeInputWrapperCls = "flex items-center gap-1 rounded-input border px-2.5 py-2 focus-within:border-accent-cyan transition-colors border-slate-200 dark:border-white/10 bg-white dark:bg-white/5";

export function SettingsPage() {
  const {
    products,
    addProduct,
    removeProduct,
    categories,
    addCategory,
    removeCategory,
    username,
    updateUsername,
    shiftsRegistry,
    addShiftType,
    removeShiftType,
    updateShiftType,
    fontFamily,
    setFontFamily,

    // OEM registries
    productCategories,
    addProductCategory,
    removeProductCategory,
    caseTypes,
    addCaseType,
    removeCaseType,
    statusUpdates,
    addStatusUpdate,
    removeStatusUpdate,
    teamMembers,
    addTeamMember,
    removeTeamMember,

    // Shift Roster presets
    shiftPresets,
    addShiftPreset,
    removeShiftPreset,

    // Auth properties
    user,
    role,
    employeeId,
  } = useNestor();

  // Accordion State - defaulted to personal settings
  const [activeSection, setActiveSection] = useState<"appearance" | "personal" | "tickets" | "oem-cases" | "tasks" | "calendar" | null>("personal");

  // Inputs
  const [tempUsername, setTempUsername] = useState(username);
  const [newProduct, setNewProduct] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newCaseType, setNewCaseType] = useState("");
  const [newStatusUpdate, setNewStatusUpdate] = useState("");
  const [newTeamMember, setNewTeamMember] = useState("");
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  // New Shift Preset inputs
  const [newShiftCode, setNewShiftCode] = useState("");
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftFrom, setNewShiftFrom] = useState("09:00");
  const [newShiftTo, setNewShiftTo] = useState("17:00");
  const [newShiftColor, setNewShiftColor] = useState("#10b981");

  // Inline shift row drafts: keyed by shift name (original)
  type ShiftDraft = { name: string; from: string; to: string };
  const [shiftDrafts, setShiftDrafts] = useState<Record<string, ShiftDraft>>(() => ({}));
  // Pending new shifts (not yet saved)
  const [pendingShifts, setPendingShifts] = useState<ShiftDraft[]>([]);

  const getDraft = (shift: { name: string; timeRange: string }): ShiftDraft => {
    if (shiftDrafts[shift.name]) return shiftDrafts[shift.name];
    const parsed = parseTimeRange(shift.timeRange);
    return { name: shift.name, from: parsed.from, to: parsed.to };
  };

  const setDraft = (originalName: string, draft: ShiftDraft) => {
    setShiftDrafts((prev) => ({ ...prev, [originalName]: draft }));
  };

  const saveShiftDraft = (originalName: string, updatedDraft?: ShiftDraft) => {
    const draft = updatedDraft || shiftDrafts[originalName];
    if (!draft) return;
    const timeRange = draft.from && draft.to
      ? `${formatTimeToAMPM(draft.from)} to ${formatTimeToAMPM(draft.to)}`
      : "";
    updateShiftType(originalName, draft.name, timeRange);
    // Update key if name changed
    if (draft.name !== originalName) {
      setShiftDrafts((prev) => {
        const updated = { ...prev };
        delete updated[originalName];
        if (updatedDraft) {
          updated[draft.name] = updatedDraft;
        }
        return updated;
      });
    }
  };

  const savePendingShift = (idx: number, updatedShifts?: ShiftDraft[]) => {
    const pList = updatedShifts || pendingShifts;
    const p = pList[idx];
    if (!p || !p.name.trim() || !p.from || !p.to) return;
    const timeRange = `${formatTimeToAMPM(p.from)} to ${formatTimeToAMPM(p.to)}`;
    addShiftType(p.name.trim(), timeRange);
    setPendingShifts((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleSection = (section: "appearance" | "personal" | "tickets" | "oem-cases" | "tasks" | "calendar") => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = tempUsername.trim();
    if (!name) return;

    if (isSupabaseConfigured && supabase && user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ username: name })
          .eq("id", user.id);
        if (error) throw error;
      } catch (err) {
        console.error("Error saving username to Supabase profiles:", err);
      }
    }

    updateUsername(name);
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProduct.trim();
    if (trimmed) {
      addProduct(trimmed);
      setNewProduct("");
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (trimmed) {
      addCategory(trimmed);
      setNewCategory("");
    }
  };

  const handleAddProductCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProductCategory.trim();
    if (trimmed) {
      addProductCategory(trimmed);
      setNewProductCategory("");
    }
  };

  const handleAddCaseType = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCaseType.trim();
    if (trimmed) {
      addCaseType(trimmed);
      setNewCaseType("");
    }
  };

  const handleAddStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStatusUpdate.trim();
    if (trimmed) {
      addStatusUpdate(trimmed);
      setNewStatusUpdate("");
    }
  };

  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTeamMember.trim();
    if (trimmed) {
      addTeamMember(trimmed);
      setNewTeamMember("");
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft dark:border-white/5 dark:bg-white/5"
      >
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">Configuration</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">System Settings</h2>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto space-y-4">
        {/* Section 1: Personal Settings */}
        <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg">
          <button
            onClick={() => toggleSection("personal")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-purple/10 p-2 text-accent-purple">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Personal Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Customize your profile metadata</p>
              </div>
            </div>
            {activeSection === "personal" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "personal" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 border-t border-slate-100 dark:border-white/5 bg-white/3 space-y-5"
              >
                {/* Supabase Profile Information */}
                {isSupabaseConfigured && user && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
                    {/* Email */}
                    <div className="flex items-center gap-3 p-3 rounded-input border border-slate-100 dark:border-white/5 dark:bg-[#0d1424]/40 bg-slate-50">
                      <div className="rounded p-2 text-accent-cyan bg-accent-cyan/10">
                        <Mail size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-soft">Email Address</p>
                        <p className="text-xs font-mono text-text-primary truncate font-semibold">{user.email}</p>
                      </div>
                    </div>

                    {/* Employee Code */}
                    <div className="flex items-center gap-3 p-3 rounded-input border border-slate-100 dark:border-white/5 dark:bg-[#0d1424]/40 bg-slate-50">
                      <div className="rounded p-2 text-accent-purple bg-accent-purple/10">
                        <Briefcase size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-soft">Employee Code</p>
                        <p className={`text-xs font-mono font-semibold truncate ${employeeId ? "text-text-primary font-bold" : "text-text-muted italic"}`}>
                          {employeeId || "Unmapped"}
                        </p>
                      </div>
                    </div>

                    {/* Security Role */}
                    <div className="flex items-center gap-3 p-3 rounded-input border border-slate-100 dark:border-white/5 dark:bg-[#0d1424]/40 bg-slate-50">
                      <div className="rounded p-2 text-accent-cyan bg-accent-cyan/10">
                        <Shield size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-text-soft">User Role</p>
                        <p className="text-xs font-semibold text-text-primary capitalize">{role}</p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleUsernameSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">
                      Username / Display Name
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={tempUsername}
                        onChange={(e) => setTempUsername(e.target.value)}
                        className={inputCls}
                      />
                      <button
                        type="submit"
                        className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-5 py-2 text-xs font-bold text-white shadow-glow flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-transform uppercase tracking-wider"
                      >
                        <Check size={14} /> Save Name
                      </button>
                    </div>
                  </div>
                </form>
                {showSavedMsg && (
                  <p className="text-xs text-success flex items-center gap-1">
                    ✓ Display name saved successfully!
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 2: Ticket Log Settings */}
        <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg">
          <button
            onClick={() => toggleSection("tickets")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-cyan/10 p-2 text-accent-cyan">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Ticket Log Module Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Products registry and incident config</p>
              </div>
            </div>
            {activeSection === "tickets" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "tickets" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 border-t border-slate-100 dark:border-white/5 bg-white/3 space-y-4"
              >
                <form onSubmit={handleAddProduct} className="flex gap-2">
                  <input
                    type="text"
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    placeholder="CrowdStrike Falcon, Sophos AV"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Add Product
                  </button>
                </form>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Configured Products ({products.length})</p>
                  <div className="grid gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                    {products.map((prod) => (
                      <div
                        key={prod}
                        className="flex items-center justify-between rounded-input border px-3.5 py-2 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{prod}</span>
                        <button
                          type="button"
                          onClick={() => removeProduct(prod)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {products.length === 0 && (
                      <p className="text-xs text-text-soft italic text-center py-4">No products registry logs.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 3: Task Log Settings */}
        <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg">
          <button
            onClick={() => toggleSection("tasks")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-cyan/10 p-2 text-accent-cyan">
                <FolderKanban size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Task Log Module Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Customize daily task categories registry</p>
              </div>
            </div>
            {activeSection === "tasks" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "tasks" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 border-t border-slate-100 dark:border-white/5 bg-white/3 space-y-4"
              >
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Incident Response, Threat Hunting"
                    className={inputCls}
                  />
                  <button
                    type="submit"
                    className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                  >
                    <Plus size={16} /> Add Category
                  </button>
                </form>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Configured Categories ({categories.length})</p>
                  <div className="grid gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                    {categories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between rounded-input border px-3.5 py-2 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => removeCategory(cat)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {categories.length === 0 && (
                      <p className="text-xs text-text-soft italic text-center py-4">No task categories configured.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 4: Calendar & Shift Roster Settings */}
        <div className={`rounded-card border overflow-visible shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg transition-all ${activeSection === "calendar" ? "relative z-40" : "relative z-10"}`}>
          <button
            onClick={() => toggleSection("calendar")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5 rounded-t-[20px]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-cyan/10 p-2 text-accent-cyan">
                <CalendarDays size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Calendar &amp; Shifts Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Customize shift codes, names, timing slots &amp; colors for Roster &amp; Calendar</p>
              </div>
            </div>
            {activeSection === "calendar" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "calendar" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-slate-100 dark:border-white/5 overflow-visible p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary">Shift Presets ({shiftPresets.length})</h4>
                    <p className="text-xs text-text-soft mt-0.5">Configure shift codes and timings for Shift Roster and Calendar</p>
                  </div>
                </div>

                {/* Existing Shift Presets List */}
                <div className="space-y-2.5 overflow-visible">
                  {shiftPresets.map((preset) => {
                    const parsed = parseTimeRange(preset.timeRange);
                    return (
                      <div
                        key={preset.code}
                        className="flex flex-wrap items-center gap-2 rounded-input border p-3 dark:border-white/10 dark:bg-white/5 relative z-20 hover:z-30 transition-all"
                      >
                        {/* Code badge */}
                        <div
                          className="w-10 h-8 rounded flex items-center justify-center text-xs font-extrabold shadow-sm flex-shrink-0"
                          style={{ backgroundColor: preset.bgHex, color: preset.textHex }}
                        >
                          {preset.code}
                        </div>

                        {/* Preset Name */}
                        <input
                          type="text"
                          value={preset.name}
                          onChange={(e) => {
                            addShiftPreset({ ...preset, name: e.target.value });
                          }}
                          className="flex-1 min-w-[140px] rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-cyan"
                          placeholder="Shift Name"
                        />

                        {/* Start Time */}
                        <TimePicker
                          value={parsed.from || "09:00"}
                          onChange={(fromVal) => {
                            const newTimeRange = `${formatTimeToAMPM(fromVal)} to ${formatTimeToAMPM(parsed.to || "17:00")}`;
                            addShiftPreset({ ...preset, timeRange: newTimeRange });
                          }}
                        />

                        {/* End Time */}
                        <TimePicker
                          value={parsed.to || "17:00"}
                          onChange={(toVal) => {
                            const newTimeRange = `${formatTimeToAMPM(parsed.from || "09:00")} to ${formatTimeToAMPM(toVal)}`;
                            addShiftPreset({ ...preset, timeRange: newTimeRange });
                          }}
                        />

                        {/* Color Selector */}
                        <select
                          value={preset.bgHex}
                          onChange={(e) => {
                            const bg = e.target.value;
                            let text = "#ffffff";
                            if (bg === "#fef08a" || bg === "#fde047") text = "#713f12";
                            addShiftPreset({ ...preset, bgHex: bg, textHex: text });
                          }}
                          className="rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-2 py-1.5 text-xs text-text-primary outline-none cursor-pointer"
                        >
                          <option value="#ea580c">Orange (General)</option>
                          <option value="#3b82f6">Blue (Evening)</option>
                          <option value="#8b5cf6">Purple (Night)</option>
                          <option value="#fef08a">Yellow (Shift 1)</option>
                          <option value="#fde047">Bright Yellow (Shift 2)</option>
                          <option value="#ef4444">Red (Leave)</option>
                          <option value="#10b981">Green (Holiday)</option>
                          <option value="#06b6d4">Cyan (Custom)</option>
                        </select>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => removeShiftPreset(preset.code)}
                          className="rounded-btn p-1.5 text-text-soft hover:bg-danger/10 hover:text-danger transition-colors ml-auto"
                          title="Remove Shift Preset"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add New Custom Shift Preset Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = newShiftCode.trim().toUpperCase();
                    const name = newShiftName.trim();
                    if (!code || !name) return;

                    const timeRange = newShiftFrom && newShiftTo
                      ? `${formatTimeToAMPM(newShiftFrom)} to ${formatTimeToAMPM(newShiftTo)}`
                      : "Custom Schedule";

                    let textHex = "#ffffff";
                    if (newShiftColor === "#fef08a" || newShiftColor === "#fde047") textHex = "#713f12";

                    addShiftPreset({
                      code,
                      name,
                      timeRange,
                      bgHex: newShiftColor,
                      textHex,
                    });

                    setNewShiftCode("");
                    setNewShiftName("");
                    setNewShiftFrom("09:00");
                    setNewShiftTo("17:00");
                  }}
                  className="rounded-card border border-accent-cyan/30 bg-accent-cyan/5 p-4 space-y-3 mt-4 relative z-10"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                    <Plus size={14} /> Add New Shift Preset (e.g. Holiday, Morning 8 to 5, General 11 to 8)
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      required
                      value={newShiftCode}
                      onChange={(e) => setNewShiftCode(e.target.value)}
                      placeholder="Code (e.g. H, S3, G2)"
                      className="w-24 rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary uppercase outline-none focus:border-accent-cyan"
                    />
                    <input
                      type="text"
                      required
                      value={newShiftName}
                      onChange={(e) => setNewShiftName(e.target.value)}
                      placeholder="Shift Name (e.g. Holiday, Morning 8 to 5)"
                      className="flex-1 min-w-[150px] rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-cyan"
                    />
                    <TimePicker
                      value={newShiftFrom}
                      onChange={setNewShiftFrom}
                    />
                    <TimePicker
                      value={newShiftTo}
                      onChange={setNewShiftTo}
                    />
                    <select
                      value={newShiftColor}
                      onChange={(e) => setNewShiftColor(e.target.value)}
                      className="rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-2 py-1.5 text-xs text-text-primary outline-none cursor-pointer"
                    >
                      <option value="#10b981">Green (Holiday)</option>
                      <option value="#fef08a">Yellow (Morning 1)</option>
                      <option value="#fde047">Bright Yellow (Morning 2)</option>
                      <option value="#ea580c">Orange (General)</option>
                      <option value="#3b82f6">Blue (Evening)</option>
                      <option value="#8b5cf6">Purple (Night)</option>
                      <option value="#ef4444">Red (Leave)</option>
                      <option value="#06b6d4">Cyan (Custom)</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-1.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase cursor-pointer"
                    >
                      Add Shift
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section: OEM Case Log Module Settings */}
        <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg">
          <button
            onClick={() => toggleSection("oem-cases")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-blue/10 p-2 text-accent-blue">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">OEM Case Log Module Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Customize categories, case types, status updates &amp; team members</p>
              </div>
            </div>
            {activeSection === "oem-cases" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "oem-cases" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 border-t border-slate-100 dark:border-white/5 bg-white/3 space-y-6"
              >
                {/* Product Categories */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Product Categories ({productCategories.length})</p>
                  <form onSubmit={handleAddProductCategory} className="flex gap-2">
                    <input
                      type="text"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      placeholder="e.g. EDR, XDR, PAM, WAF, DLP"
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                    >
                      <Plus size={16} /> Add Category
                    </button>
                  </form>
                  <div className="grid gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {productCategories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between rounded-input border px-3.5 py-1.5 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => removeProductCategory(cat)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case Types */}
                <div className="space-y-3 border-t pt-5 dark:border-white/5 border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Case Types ({caseTypes.length})</p>
                  <form onSubmit={handleAddCaseType} className="flex gap-2">
                    <input
                      type="text"
                      value={newCaseType}
                      onChange={(e) => setNewCaseType(e.target.value)}
                      placeholder="e.g. Hash Blocking, Feature Request, Escalation"
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                    >
                      <Plus size={16} /> Add Type
                    </button>
                  </form>
                  <div className="grid gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {caseTypes.map((type) => (
                      <div
                        key={type}
                        className="flex items-center justify-between rounded-input border px-3.5 py-1.5 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{type}</span>
                        <button
                          type="button"
                          onClick={() => removeCaseType(type)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Updates / Last Update Received */}
                <div className="space-y-3 border-t pt-5 dark:border-white/5 border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Status Update / Last Update Options ({statusUpdates.length})</p>
                  <form onSubmit={handleAddStatusUpdate} className="flex gap-2">
                    <input
                      type="text"
                      value={newStatusUpdate}
                      onChange={(e) => setNewStatusUpdate(e.target.value)}
                      placeholder="e.g. Pending From OEM, Pending Customer, Issue Resolved"
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                    >
                      <Plus size={16} /> Add Option
                    </button>
                  </form>
                  <div className="grid gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {statusUpdates.map((st) => (
                      <div
                        key={st}
                        className="flex items-center justify-between rounded-input border px-3.5 py-1.5 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{st}</span>
                        <button
                          type="button"
                          onClick={() => removeStatusUpdate(st)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Members List */}
                <div className="space-y-3 border-t pt-5 dark:border-white/5 border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-soft">Team Members (Assigned To / Raised By List) ({teamMembers.length})</p>
                  <form onSubmit={handleAddTeamMember} className="flex gap-2">
                    <input
                      type="text"
                      value={newTeamMember}
                      onChange={(e) => setNewTeamMember(e.target.value)}
                      placeholder="e.g. Samir, Mary, Alex"
                      className={inputCls}
                    />
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-sm font-medium text-text-primary shadow-glow flex items-center gap-1.5"
                    >
                      <Plus size={16} /> Add Member
                    </button>
                  </form>
                  <div className="grid gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {teamMembers.map((m) => (
                      <div
                        key={m}
                        className="flex items-center justify-between rounded-input border px-3.5 py-1.5 text-sm text-text-muted border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => removeTeamMember(m)}
                          className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Section 5: Appearance Settings (Dragged to last) */}
        <div className="rounded-card border overflow-hidden shadow-soft backdrop-blur-[18px] dark:border-white/5 dark:bg-card-bg">
          <button
            onClick={() => toggleSection("appearance")}
            className="w-full flex items-center justify-between p-5 text-left border-b border-transparent transition-all dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-badge bg-accent-purple/10 p-2 text-accent-purple">
                <Paintbrush size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">Appearance Settings</h3>
                <p className="text-xs text-text-soft mt-0.5">Customize application font styling and typography</p>
              </div>
            </div>
            {activeSection === "appearance" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          <AnimatePresence initial={false}>
            {activeSection === "appearance" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-5 border-t border-slate-100 dark:border-white/5 bg-white/3 space-y-5"
              >
                <p className="text-xs text-text-soft">Choose typography options for Nestor. Changes apply instantly.</p>
                
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-2.5">Application Font</h4>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
                  {[
                    { name: "Inter", font: "var(--font-inter), sans-serif", desc: "Sans-Serif (Default)" },
                    { name: "Roboto", font: "'Roboto', sans-serif", desc: "Sans-Serif (Clean)" },
                    { name: "Lato", font: "'Lato', sans-serif", desc: "Sans-Serif (Warm)" },
                    { name: "Outfit", font: "'Outfit', sans-serif", desc: "Geometric (Modern)" },
                    { name: "Poppins", font: "'Poppins', sans-serif", desc: "Rounded (Friendly)" },
                    { name: "Merriweather", font: "'Merriweather', serif", desc: "Editorial (Serif)" },
                    { name: "Times New Roman", font: "'Times New Roman', Times, serif", desc: "Classic (Serif)" },
                    { name: "Fira Code", font: "'Fira Code', monospace", desc: "Monospace (Tech)" },
                    { name: "Courier New", font: "'Courier New', Courier, monospace", desc: "Retro (Typewriter)" },
                    { name: "Playfair Display", font: "'Playfair Display', serif", desc: "Elegant (Serif)" }
                  ].map((f) => {
                    const isSelected = fontFamily === f.name;
                    return (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => setFontFamily(f.name)}
                        className={`rounded-[12px] border p-3 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-accent-purple/50 bg-accent-purple/10 shadow-[0_4px_12px_rgba(168,85,247,0.12)]"
                            : "border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/15"
                        }`}
                      >
                        <span 
                          className="text-sm font-semibold text-text-primary block"
                          style={{ fontFamily: f.font }}
                        >
                          {f.name}
                        </span>
                        <span className="text-[9px] text-text-soft block mt-0.5">{f.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
