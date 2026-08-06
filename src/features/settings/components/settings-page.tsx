"use client";

import { useState } from "react";
import { useNestor } from "@/src/shared/context/nestor-context";
import {
  Plus,
  Trash2,
  Shield,
  User,
  Check,
  FolderKanban,
  CalendarDays,
  Paintbrush,
  Mail,
  Briefcase,
  KeyRound,
  ShieldAlert,
  LifeBuoy,
  TriangleAlert,
  Lock,
  Ticket,
  ShieldCheck,
  Users,
  Eye,
  EyeOff,
  Lock as LockIcon,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TimePicker } from "@/src/shared/components/ui/time-picker";
import { CustomSelect } from "@/src/shared/components/ui/custom-select";
import { supabase, isSupabaseConfigured } from "@/src/shared/lib/supabase";
import { RecoveryCodeModal } from "@/src/shared/components/ui/recovery-code-modal";

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
  const colonMatch = timeRange.match(/(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})/);
  if (colonMatch) return { from: colonMatch[1].padStart(5, "0"), to: colonMatch[2].padStart(5, "0") };
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

const inputCls =
  "flex-1 rounded-input border px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent-cyan transition-colors border-slate-200 dark:border-white/10 bg-white dark:bg-white/5";

const SHIFT_COLOR_OPTIONS = [
  { value: "#ea580c", label: "Orange (General)" },
  { value: "#3b82f6", label: "Blue (Evening)" },
  { value: "#8b5cf6", label: "Purple (Night)" },
  { value: "#fef08a", label: "Yellow (Shift 1)" },
  { value: "#fde047", label: "Bright Yellow (Shift 2)" },
  { value: "#ef4444", label: "Red (Leave)" },
  { value: "#10b981", label: "Green (Holiday)" },
  { value: "#06b6d4", label: "Cyan (Custom)" },
];

const ACCENT_THEMES = [
  { id: "default", label: "Violet & Cyan", from: "#a855f7", to: "#22d3ee" },
  { id: "blue", label: "Blue & Teal", from: "#3b82f6", to: "#14b8a6" },
  { id: "emerald", label: "Emerald & Lime", from: "#10b981", to: "#84cc16" },
  { id: "rose", label: "Rose & Amber", from: "#f43f5e", to: "#f59e0b" },
];

// ── Shared building blocks ───────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-100 dark:border-white/5">
      <div className="rounded-[14px] bg-gradient-to-br from-accent-purple/15 to-accent-cyan/15 p-2.5 text-accent-purple flex-shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-text-primary">{title}</h3>
        <p className="text-xs text-text-soft mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border p-5 shadow-soft dark:border-white/5 dark:bg-white/[0.02] border-slate-200 bg-white ${className}`}>
      {children}
    </div>
  );
}

/** Generic add/remove string-list manager — used by every module's registry
 * (Ticket products, Task categories, OEM categories/case types/statuses).
 * `protectedItems` renders as locked, non-removable chips (e.g. Learning/Meeting). */
function RegistryList({
  items,
  onAdd,
  onRemove,
  placeholder,
  emptyLabel,
  protectedItems = [],
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  emptyLabel: string;
  protectedItems?: string[];
}) {
  const [value, setValue] = useState("");
  const isProtected = (item: string) => protectedItems.some((p) => p.toLowerCase() === item.toLowerCase());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={inputCls} />
        <button
          type="submit"
          className="flex-shrink-0 flex items-center gap-1.5 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all cursor-pointer uppercase tracking-wider"
        >
          <Plus size={14} /> Add
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const locked = isProtected(item);
          return (
            <span
              key={item}
              className={`group flex items-center gap-1.5 rounded-pill border pl-3.5 pr-2 py-1.5 text-xs font-semibold transition-all ${
                locked
                  ? "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-text-soft"
                  : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-text-primary hover:border-danger/30"
              }`}
            >
              {item}
              {locked ? (
                <span title="Required — can't be removed" className="inline-flex text-text-muted">
                  <LockIcon size={11} />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="rounded-full p-0.5 text-text-soft hover:bg-danger/15 hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </span>
          );
        })}
        {items.length === 0 && <p className="text-xs text-text-soft italic py-2">{emptyLabel}</p>}
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-input border border-slate-100 dark:border-white/5 dark:bg-[#0d1424]/40 bg-slate-50">
      <div className={`rounded-[10px] p-2 flex-shrink-0 ${accent}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-soft">{label}</p>
        <p className="text-xs font-semibold text-text-primary truncate">{value}</p>
      </div>
    </div>
  );
}

type SectionId = "profile" | "appearance" | "tickets" | "tasks" | "calendar" | "oem" | "vault";

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
    shiftPresets,
    addShiftPreset,
    removeShiftPreset,
    fontFamily,
    setFontFamily,
    accentTheme,
    setAccentTheme,

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
    rosterMembers,

    // Password Vault security (admin-only)
    masterPassword,
    updateMasterPassword,
    teamVaultRecoveryKitActive,
    setupTeamVaultRecoveryKit,
    recoverTeamVaultWithCode,
    resetTeamVault,

    // Auth properties
    user,
    role,
    employeeId,
  } = useNestor();

  const isAdmin = role === "admin";

  const NAV_SECTIONS: { id: SectionId; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Paintbrush },
    { id: "tickets", label: "Ticket Log", icon: Ticket },
    { id: "tasks", label: "Task Log", icon: FolderKanban },
    { id: "calendar", label: "Calendar & Shifts", icon: CalendarDays },
    { id: "oem", label: "OEM Case Log", icon: ShieldCheck },
    { id: "vault", label: "Password Vault", icon: KeyRound, adminOnly: true },
  ];
  const visibleSections = NAV_SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  const [activeSection, setActiveSection] = useState<SectionId>("profile");

  // ── My Profile: display name ──
  const [tempUsername, setTempUsername] = useState(username);
  const [nameMsg, setNameMsg] = useState(false);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = tempUsername.trim();
    if (!name) return;
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { error } = await supabase.from("profiles").update({ username: name }).eq("id", user.id);
        if (error) throw error;
      } catch (err) {
        console.error("Error saving username to Supabase profiles:", err);
      }
    }
    updateUsername(name);
    setNameMsg(true);
    setTimeout(() => setNameMsg(false), 2500);
  };

  // ── My Profile: change email ──
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPw, setEmailCurrentPw] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);
    const trimmed = newEmail.trim();
    if (!trimmed || !user?.email || !supabase) return;
    if (trimmed.toLowerCase() === user.email.toLowerCase()) {
      setEmailMsg({ type: "error", text: "That's already your current email address." });
      return;
    }
    setIsChangingEmail(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: emailCurrentPw });
      if (signInErr) {
        setEmailMsg({ type: "error", text: "Your current password is incorrect." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      try {
        await supabase.from("profiles").update({ email: trimmed }).eq("id", user.id);
      } catch (err) {
        console.error("Error syncing new email to profiles:", err);
      }
      setEmailMsg({ type: "success", text: "Email updated. If your project requires confirmation, check your inbox to finish the change." });
      setNewEmail("");
      setEmailCurrentPw("");
    } catch (err: any) {
      setEmailMsg({ type: "error", text: err.message || "Failed to update email." });
    } finally {
      setIsChangingEmail(false);
    }
  };

  // ── My Profile: change login password ──
  const [currentLoginPw, setCurrentLoginPw] = useState("");
  const [newLoginPw, setNewLoginPw] = useState("");
  const [confirmLoginPw, setConfirmLoginPw] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!user?.email || !supabase) return;
    if (newLoginPw.length < 6) {
      setPasswordMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newLoginPw !== confirmLoginPw) {
      setPasswordMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentLoginPw });
      if (signInErr) {
        setPasswordMsg({ type: "error", text: "Your current password is incorrect." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newLoginPw });
      if (error) throw error;
      setPasswordMsg({ type: "success", text: "Password updated successfully." });
      setCurrentLoginPw("");
      setNewLoginPw("");
      setConfirmLoginPw("");
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ── Calendar & Shifts (admin edit form state) ──
  const [newShiftCode, setNewShiftCode] = useState("");
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftFrom, setNewShiftFrom] = useState("09:00");
  const [newShiftTo, setNewShiftTo] = useState("17:00");
  const [newShiftColor, setNewShiftColor] = useState("#10b981");

  // ── Password Vault Security (admin-only) ──
  const [oldMasterPin, setOldMasterPin] = useState("");
  const [newMasterPin, setNewMasterPin] = useState("");
  const [confirmMasterPin, setConfirmMasterPin] = useState("");
  const [isSavingMasterPin, setIsSavingMasterPin] = useState(false);

  const handleMasterPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldMasterPin !== masterPassword) {
      alert("Current team master password is incorrect.");
      return;
    }
    if (!newMasterPin.trim()) return;
    if (newMasterPin !== confirmMasterPin) {
      alert("New password and confirmation do not match.");
      return;
    }
    setIsSavingMasterPin(true);
    try {
      await updateMasterPassword(newMasterPin.trim());
      setOldMasterPin("");
      setNewMasterPin("");
      setConfirmMasterPin("");
    } finally {
      setIsSavingMasterPin(false);
    }
  };

  const [isSettingUpRecoveryKit, setIsSettingUpRecoveryKit] = useState(false);
  const [revealedRecoveryCode, setRevealedRecoveryCode] = useState<string | null>(null);
  const [recoveryCodeModalTitle, setRecoveryCodeModalTitle] = useState("");

  const [showRecoverForm, setShowRecoverForm] = useState(false);
  const [recoverCodeInput, setRecoverCodeInput] = useState("");
  const [recoverNewPin, setRecoverNewPin] = useState("");
  const [recoverConfirmPin, setRecoverConfirmPin] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  const [showResetForm, setShowResetForm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleSetupRecoveryKit = async () => {
    setIsSettingUpRecoveryKit(true);
    try {
      const code = await setupTeamVaultRecoveryKit();
      if (code) {
        setRecoveryCodeModalTitle("Team Vault Recovery Code");
        setRevealedRecoveryCode(code);
      }
    } finally {
      setIsSettingUpRecoveryKit(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverCodeInput.trim() || !recoverNewPin.trim()) return;
    if (recoverNewPin !== recoverConfirmPin) {
      alert("New password and confirmation do not match.");
      return;
    }
    setIsRecovering(true);
    try {
      const ok = await recoverTeamVaultWithCode(recoverCodeInput, recoverNewPin.trim());
      if (ok) {
        setShowRecoverForm(false);
        setRecoverCodeInput("");
        setRecoverNewPin("");
        setRecoverConfirmPin("");
      }
    } finally {
      setIsRecovering(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText.trim().toUpperCase() !== "RESET") {
      alert('Type "RESET" to confirm — this permanently deletes every team credential set.');
      return;
    }
    if (!resetNewPin.trim()) return;
    if (resetNewPin !== resetConfirmPin) {
      alert("New password and confirmation do not match.");
      return;
    }
    setIsResetting(true);
    try {
      const code = await resetTeamVault(resetNewPin.trim());
      if (code) {
        setShowResetForm(false);
        setResetConfirmText("");
        setResetNewPin("");
        setResetConfirmPin("");
        setRecoveryCodeModalTitle("New Team Vault Recovery Code");
        setRevealedRecoveryCode(code);
      }
    } finally {
      setIsResetting(false);
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

      <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        {/* ── Left Nav ── */}
        <nav className="rounded-card border shadow-soft dark:border-white/5 dark:bg-card-bg p-2 lg:sticky lg:top-4 overflow-x-auto lg:overflow-visible">
          <div className="flex lg:flex-col gap-1 min-w-max lg:min-w-0">
            {visibleSections.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2.5 rounded-input px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-accent-purple to-accent-cyan text-white shadow-glow"
                      : "text-text-soft hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <Icon size={15} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content Panel ── */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* ══ My Profile ══ */}
          {activeSection === "profile" && (
            <Card className="space-y-6">
              <SectionHeader icon={User} title="My Profile" description="Manage your account details, display name, and login credentials" />

              {isSupabaseConfigured && user && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <InfoTile icon={Mail} label="Email Address" value={user.email || "—"} accent="text-accent-cyan bg-accent-cyan/10" />
                  <InfoTile icon={Briefcase} label="Employee Code" value={employeeId || "Unmapped"} accent="text-accent-purple bg-accent-purple/10" />
                  <InfoTile icon={Shield} label="User Role" value={role} accent="text-accent-cyan bg-accent-cyan/10" />
                </div>
              )}

              <form onSubmit={handleUsernameSubmit} className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft">Display Name</label>
                <div className="flex gap-2">
                  <input type="text" value={tempUsername} onChange={(e) => setTempUsername(e.target.value)} className={inputCls} />
                  <button
                    type="submit"
                    className="flex-shrink-0 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-5 py-2.5 text-xs font-bold text-white shadow-glow flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-transform uppercase tracking-wider"
                  >
                    <Check size={14} /> Save
                  </button>
                </div>
                {nameMsg && <p className="text-xs text-success flex items-center gap-1 pt-1">✓ Display name saved successfully!</p>}
              </form>

              {isSupabaseConfigured && user && (
                <>
                  <form onSubmit={handleChangeEmail} className="border-t border-slate-100 dark:border-white/5 pt-5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
                      <Mail size={13} /> Change Email Address
                    </h4>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input
                        type="email"
                        required
                        placeholder="New email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={inputCls}
                      />
                      <input
                        type="password"
                        required
                        placeholder="Current password (to confirm)"
                        value={emailCurrentPw}
                        onChange={(e) => setEmailCurrentPw(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isChangingEmail}
                      className="rounded-btn border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2 text-xs font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isChangingEmail ? "Updating…" : "Update Email"}
                    </button>
                    {emailMsg && (
                      <p className={`text-xs flex items-center gap-1 pt-1 ${emailMsg.type === "success" ? "text-success" : "text-danger"}`}>
                        {emailMsg.type === "success" ? "✓" : "⚠"} {emailMsg.text}
                      </p>
                    )}
                  </form>

                  <form onSubmit={handleChangePassword} className="border-t border-slate-100 dark:border-white/5 pt-5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
                      <Lock size={13} /> Change Login Password
                    </h4>
                    <input
                      type="password"
                      required
                      placeholder="Current password"
                      value={currentLoginPw}
                      onChange={(e) => setCurrentLoginPw(e.target.value)}
                      className={`${inputCls} w-full`}
                    />
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <div className="relative">
                        <input
                          type={showLoginPw ? "text" : "password"}
                          required
                          minLength={6}
                          placeholder="New password"
                          value={newLoginPw}
                          onChange={(e) => setNewLoginPw(e.target.value)}
                          className={`${inputCls} w-full pr-9`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-soft hover:text-text-primary cursor-pointer"
                        >
                          {showLoginPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <input
                        type={showLoginPw ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="Confirm new password"
                        value={confirmLoginPw}
                        onChange={(e) => setConfirmLoginPw(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
                    >
                      {isChangingPassword ? "Updating…" : "Update Password"}
                    </button>
                    {passwordMsg && (
                      <p className={`text-xs flex items-center gap-1 pt-1 ${passwordMsg.type === "success" ? "text-success" : "text-danger"}`}>
                        {passwordMsg.type === "success" ? "✓" : "⚠"} {passwordMsg.text}
                      </p>
                    )}
                  </form>
                </>
              )}
            </Card>
          )}

          {/* ══ Appearance ══ */}
          {activeSection === "appearance" && (
            <Card className="space-y-6">
              <SectionHeader icon={Paintbrush} title="Appearance" description="Personalize typography and accent colors. Changes apply instantly." />

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-3">Accent Theme</h4>
                <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
                  {ACCENT_THEMES.map((t) => {
                    const isSelected = accentTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAccentTheme(t.id)}
                        className={`rounded-[14px] border p-3 text-left transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? "border-accent-purple/50 bg-accent-purple/10 shadow-[0_4px_12px_rgba(168,85,247,0.12)]"
                            : "border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10"
                        }`}
                      >
                        <div
                          className="h-6 w-full rounded-md mb-2"
                          style={{ background: `linear-gradient(90deg, ${t.from}, ${t.to})` }}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-primary">{t.label}</span>
                          {isSelected && <Check size={13} className="text-accent-purple" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-3">Application Font</h4>
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
                    { name: "Playfair Display", font: "'Playfair Display', serif", desc: "Elegant (Serif)" },
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
                        <span className="text-sm font-semibold text-text-primary block" style={{ fontFamily: f.font }}>
                          {f.name}
                        </span>
                        <span className="text-[9px] text-text-soft block mt-0.5">{f.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* ══ Ticket Log Settings ══ */}
          {activeSection === "tickets" && (
            <Card>
              <SectionHeader icon={Ticket} title="Ticket Log Module Settings" description={`Products registry (${products.length} configured)`} />
              <RegistryList
                items={products}
                onAdd={addProduct}
                onRemove={removeProduct}
                placeholder="e.g. CrowdStrike Falcon, Sophos AV"
                emptyLabel="No products configured yet."
              />
            </Card>
          )}

          {/* ══ Task Log Settings ══ */}
          {activeSection === "tasks" && (
            <Card>
              <SectionHeader icon={FolderKanban} title="Task Log Module Settings" description={`Task categories (${categories.length} configured) — Learning & Meeting are required and can't be removed`} />
              <RegistryList
                items={categories}
                onAdd={addCategory}
                onRemove={removeCategory}
                placeholder="e.g. Incident Response, Threat Hunting"
                emptyLabel="No task categories configured."
                protectedItems={["Learning", "Meeting"]}
              />
            </Card>
          )}

          {/* ══ Calendar & Shifts ══ */}
          {activeSection === "calendar" && (
            <Card className="space-y-5">
              <SectionHeader
                icon={CalendarDays}
                title="Calendar & Shifts"
                description={
                  isAdmin
                    ? `Shift presets used across the Shift Roster and Calendar (${shiftPresets.length} configured)`
                    : "Shift templates available on the roster — view only"
                }
              />

              <div className="space-y-2.5">
                {shiftPresets.map((preset) => {
                  const parsed = parseTimeRange(preset.timeRange);
                  return (
                    <div
                      key={preset.code}
                      className="flex flex-wrap items-center gap-2 rounded-input border p-3 dark:border-white/10 dark:bg-white/5 border-slate-200 bg-slate-50"
                    >
                      <div
                        className="w-10 h-8 rounded flex items-center justify-center text-xs font-extrabold shadow-sm flex-shrink-0"
                        style={{ backgroundColor: preset.bgHex, color: preset.textHex }}
                      >
                        {preset.code}
                      </div>

                      {isAdmin ? (
                        <>
                          <input
                            type="text"
                            value={preset.name}
                            onChange={(e) => addShiftPreset({ ...preset, name: e.target.value })}
                            className="flex-1 min-w-[140px] rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent-cyan"
                            placeholder="Shift Name"
                          />
                          <TimePicker
                            value={parsed.from || "09:00"}
                            onChange={(fromVal) => {
                              const newTimeRange = `${formatTimeToAMPM(fromVal)} to ${formatTimeToAMPM(parsed.to || "17:00")}`;
                              addShiftPreset({ ...preset, timeRange: newTimeRange });
                            }}
                          />
                          <TimePicker
                            value={parsed.to || "17:00"}
                            onChange={(toVal) => {
                              const newTimeRange = `${formatTimeToAMPM(parsed.from || "09:00")} to ${formatTimeToAMPM(toVal)}`;
                              addShiftPreset({ ...preset, timeRange: newTimeRange });
                            }}
                          />
                          <CustomSelect
                            value={preset.bgHex}
                            onChange={(bg) => {
                              let text = "#ffffff";
                              if (bg === "#fef08a" || bg === "#fde047") text = "#713f12";
                              addShiftPreset({ ...preset, bgHex: bg, textHex: text });
                            }}
                            options={SHIFT_COLOR_OPTIONS}
                            width="w-44"
                            uppercase={false}
                          />
                          <button
                            type="button"
                            onClick={() => removeShiftPreset(preset.code)}
                            className="rounded-btn p-1.5 text-text-soft hover:bg-danger/10 hover:text-danger transition-colors ml-auto cursor-pointer"
                            title="Remove Shift Preset"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-text-primary">{preset.name}</span>
                          <span className="text-xs text-text-soft ml-auto font-mono">{preset.timeRange}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                {shiftPresets.length === 0 && <p className="text-xs text-text-soft italic py-4 text-center">No shift presets configured.</p>}
              </div>

              {isAdmin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = newShiftCode.trim().toUpperCase();
                    const name = newShiftName.trim();
                    if (!code || !name) return;
                    const timeRange =
                      newShiftFrom && newShiftTo ? `${formatTimeToAMPM(newShiftFrom)} to ${formatTimeToAMPM(newShiftTo)}` : "Custom Schedule";
                    let textHex = "#ffffff";
                    if (newShiftColor === "#fef08a" || newShiftColor === "#fde047") textHex = "#713f12";
                    addShiftPreset({ code, name, timeRange, bgHex: newShiftColor, textHex });
                    setNewShiftCode("");
                    setNewShiftName("");
                    setNewShiftFrom("09:00");
                    setNewShiftTo("17:00");
                  }}
                  className="rounded-card border border-accent-cyan/30 bg-accent-cyan/5 p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent-cyan flex items-center gap-1.5">
                    <Plus size={14} /> Add New Shift Preset
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
                    <TimePicker value={newShiftFrom} onChange={setNewShiftFrom} />
                    <TimePicker value={newShiftTo} onChange={setNewShiftTo} />
                    <CustomSelect value={newShiftColor} onChange={setNewShiftColor} options={SHIFT_COLOR_OPTIONS} width="w-44" uppercase={false} />
                    <button
                      type="submit"
                      className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-1.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase cursor-pointer"
                    >
                      Add Shift
                    </button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {/* ══ OEM Case Log Settings ══ */}
          {activeSection === "oem" && (
            <Card className="space-y-6">
              <SectionHeader icon={ShieldCheck} title="OEM Case Log Module Settings" description="Categories, case types, status options, and the active team roster" />

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-2.5">Product Categories ({productCategories.length})</h4>
                <RegistryList
                  items={productCategories}
                  onAdd={addProductCategory}
                  onRemove={removeProductCategory}
                  placeholder="e.g. EDR, XDR, PAM, WAF, DLP"
                  emptyLabel="No product categories configured."
                />
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-2.5">Case Types ({caseTypes.length})</h4>
                <RegistryList
                  items={caseTypes}
                  onAdd={addCaseType}
                  onRemove={removeCaseType}
                  placeholder="e.g. Hash Blocking, Feature Request, Escalation"
                  emptyLabel="No case types configured."
                />
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-2.5">Status Update Options ({statusUpdates.length})</h4>
                <RegistryList
                  items={statusUpdates}
                  onAdd={addStatusUpdate}
                  onRemove={removeStatusUpdate}
                  placeholder="e.g. Pending From OEM, Pending Customer, Issue Resolved"
                  emptyLabel="No status update options configured."
                />
              </div>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft mb-2.5 flex items-center gap-1.5">
                  <Users size={13} /> Team Members ({rosterMembers.length})
                </h4>
                <p className="text-xs text-text-soft mb-3">
                  "Assigned To" / "Raised By" options are pulled live from active user accounts — manage who appears
                  here from <span className="font-semibold text-text-primary">User Management</span>, not here.
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 max-h-[220px] overflow-y-auto pr-1">
                  {rosterMembers.map((m) => (
                    <div
                      key={m.employeeId}
                      className="flex items-center gap-2.5 rounded-input border px-3 py-2 border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5"
                    >
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {m.name.trim().charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-text-primary block truncate">{m.name}</span>
                        <span className="text-[10px] text-text-soft font-mono">ID: {m.employeeId}</span>
                      </div>
                    </div>
                  ))}
                  {rosterMembers.length === 0 && <p className="text-xs text-text-soft italic py-2 sm:col-span-2">No active users found.</p>}
                </div>
              </div>
            </Card>
          )}

          {/* ══ Password Vault Security (admin-only) ══ */}
          {activeSection === "vault" && isAdmin && (
            <Card className="space-y-5">
              <SectionHeader icon={KeyRound} title="Password Vault Security" description="Admin-only: manage the shared Team Vault master password" />

              <div className="flex items-start gap-2.5 rounded-input border border-accent-cyan/20 bg-accent-cyan/5 p-3.5 text-xs text-text-soft leading-relaxed">
                <ShieldAlert size={15} className="text-accent-cyan flex-shrink-0 mt-0.5" />
                <span>
                  This is the shared encryption passphrase that protects every credential in the Team Vault
                  (Products/Clients tab of Password Vault). Changing it re-encrypts every existing team credential
                  set automatically — every admin and member must be told the new password to keep viewing team
                  credentials. This does not affect anyone's Personal Vault, which each user secures with their own
                  independent PIN.
                </span>
              </div>

              <form onSubmit={handleMasterPinSubmit} className="grid gap-3 sm:grid-cols-2 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">Current Master Password</label>
                  <input type="password" required value={oldMasterPin} onChange={(e) => setOldMasterPin(e.target.value)} className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">New Master Password</label>
                  <input type="password" required value={newMasterPin} onChange={(e) => setNewMasterPin(e.target.value)} className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-soft mb-1.5">Confirm New Master Password</label>
                  <input type="password" required value={confirmMasterPin} onChange={(e) => setConfirmMasterPin(e.target.value)} className={`${inputCls} w-full`} />
                </div>
                <button
                  type="submit"
                  disabled={isSavingMasterPin}
                  className="sm:col-span-2 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-2.5 text-xs font-bold text-white shadow-glow hover:scale-[1.01] transition-all uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSavingMasterPin ? "Re-encrypting Team Vault…" : "Update Team Master Password"}
                </button>
              </form>

              <div className="border-t border-slate-100 dark:border-white/5 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
                    <LifeBuoy size={13} /> Recovery Kit
                  </h4>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider rounded-badge px-2 py-0.5 ${
                      teamVaultRecoveryKitActive ? "bg-success/15 text-success" : "bg-text-soft/10 text-text-soft"
                    }`}
                  >
                    {teamVaultRecoveryKitActive ? "Active" : "Not Set Up"}
                  </span>
                </div>

                {!teamVaultRecoveryKitActive ? (
                  <div className="space-y-2">
                    <p className="text-xs text-text-soft leading-relaxed">
                      Without a Recovery Kit, forgetting the Team Master Password means every team credential is
                      permanently unrecoverable. Setting one up generates a one-time backup code that can restore
                      access without losing any data.
                    </p>
                    <button
                      type="button"
                      onClick={handleSetupRecoveryKit}
                      disabled={isSettingUpRecoveryKit}
                      className="rounded-btn border border-accent-cyan/30 bg-accent-cyan/10 px-3.5 py-2 text-xs font-bold text-accent-cyan hover:bg-accent-cyan/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSettingUpRecoveryKit ? "Setting up…" : "Set Up Recovery Kit"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-text-soft leading-relaxed">
                    A Recovery Kit is active. If the Master Password is ever forgotten, use the recovery code (shown
                    once, at setup) to regain access below.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoverForm((v) => !v);
                      setShowResetForm(false);
                    }}
                    className="text-xs font-semibold text-accent-cyan hover:underline cursor-pointer"
                  >
                    Forgot the master password? Recover with code
                  </button>
                  <span className="text-text-soft text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetForm((v) => !v);
                      setShowRecoverForm(false);
                    }}
                    className="text-xs font-semibold text-danger hover:underline cursor-pointer"
                  >
                    Lost both? Reset &amp; wipe (last resort)
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {showRecoverForm && (
                    <motion.form
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      onSubmit={handleRecoverSubmit}
                      className="space-y-2.5 rounded-input border border-accent-cyan/20 bg-accent-cyan/5 p-3 overflow-hidden"
                    >
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">Recovery Code</label>
                        <input
                          type="text"
                          required
                          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                          value={recoverCodeInput}
                          onChange={(e) => setRecoverCodeInput(e.target.value)}
                          className={`${inputCls} font-mono w-full`}
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-text-soft mb-1">New Master Password</label>
                          <input type="password" required value={recoverNewPin} onChange={(e) => setRecoverNewPin(e.target.value)} className={`${inputCls} w-full`} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-soft mb-1">Confirm New Password</label>
                          <input type="password" required value={recoverConfirmPin} onChange={(e) => setRecoverConfirmPin(e.target.value)} className={`${inputCls} w-full`} />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isRecovering}
                        className="w-full rounded-btn bg-accent-cyan py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        {isRecovering ? "Recovering…" : "Recover Team Vault"}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {showResetForm && (
                    <motion.form
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      onSubmit={handleResetSubmit}
                      className="space-y-2.5 rounded-input border border-danger/30 bg-danger/5 p-3 overflow-hidden"
                    >
                      <div className="flex items-start gap-2 text-xs text-danger">
                        <TriangleAlert size={14} className="flex-shrink-0 mt-0.5" />
                        <span>
                          This permanently <strong>deletes every Team Vault credential set</strong> — they were
                          encrypted under the forgotten password and cannot be salvaged. Only use this if the
                          recovery code is also lost.
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">Type RESET to confirm</label>
                        <input type="text" required value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} className={`${inputCls} w-full`} />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-text-soft mb-1">New Master Password</label>
                          <input type="password" required value={resetNewPin} onChange={(e) => setResetNewPin(e.target.value)} className={`${inputCls} w-full`} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-soft mb-1">Confirm New Password</label>
                          <input type="password" required value={resetConfirmPin} onChange={(e) => setResetConfirmPin(e.target.value)} className={`${inputCls} w-full`} />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="w-full rounded-btn bg-danger py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        {isResetting ? "Resetting…" : "Permanently Reset Team Vault"}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          )}
        </motion.div>
      </div>

      <RecoveryCodeModal code={revealedRecoveryCode} title={recoveryCodeModalTitle} onClose={() => setRevealedRecoveryCode(null)} />
    </div>
  );
}
