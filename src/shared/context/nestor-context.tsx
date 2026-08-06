"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  deriveVaultKey,
  encryptVaultPayload,
  decryptVaultPayload,
  isEncryptedEnvelope,
  generateDataEncryptionKey,
  wrapDataEncryptionKey,
  unwrapDataEncryptionKey,
  generateRecoveryCode,
  normalizeRecoveryCode,
  type EncryptedEnvelope,
} from "../lib/vault-crypto";
import type { Task, TaskCategory, TaskStatus } from "@/src/features/task/types";
import type { Ticket, TicketPriority, TicketStatus, TicketWorkLog } from "@/src/features/ticket/types";
import type { ShiftType, ShiftAssignment } from "@/src/features/calendar/types";
import type { OemCase } from "@/src/features/oem-case/types";
import type { RosterMember, ShiftPreset } from "@/src/features/shift-roster/types";
import type { VaultProductGroup, PersonalVaultEntry, VaultEntry, VaultField, VaultChangeRequest } from "@/src/features/password-vault/types";
const initialTasks: Task[] = [];
const initialOemCases: OemCase[] = [];
const initialRosterMembers: RosterMember[] = [];
const initialShiftPresets: ShiftPreset[] = [
  { code: "S1", name: "Shift 1 (Morning 1)", timeRange: "08:00 AM to 05:00 PM", bgHex: "#fef08a", textHex: "#854d0e" },
  { code: "G", name: "General Shift", timeRange: "10:00 AM to 07:00 PM", bgHex: "#ea580c", textHex: "#ffffff" },
  { code: "E", name: "Evening Shift", timeRange: "01:00 PM to 10:00 PM", bgHex: "#3b82f6", textHex: "#ffffff" },
  { code: "N", name: "Night Shift", timeRange: "10:00 PM to 07:00 AM", bgHex: "#8b5cf6", textHex: "#ffffff" },
  { code: "WO", name: "Weekly Off", timeRange: "09:00 AM to 05:00 PM", bgHex: "#fef08a", textHex: "#854d0e", isOffOrLeave: true },
  { code: "L", name: "Leave", timeRange: "09:00 AM to 05:00 PM", bgHex: "#ef4444", textHex: "#ffffff", isOffOrLeave: true },
];
const generateInitialAssignments = () => ({});
const initialVaultProducts: VaultProductGroup[] = [];
const initialPersonalVault: PersonalVaultEntry[] = [];

// Standard mock tickets
const initialTickets: Ticket[] = [];

export type ThemeMode = "light" | "dark" | "system";

export interface Toast {
  id: number;
  message: string;
  type: "error" | "success";
}

interface NestorContextType {
  tasks: Task[];
  tickets: Ticket[];
  loadingTasks: boolean;
  loadingTickets: boolean;
  isSupabaseActive: boolean;

  // Toasts (surfaced save/sync errors)
  toasts: Toast[];
  showToast: (message: string, type?: "error" | "success") => void;
  dismissToast: (id: number) => void;

  // Tasks CRUD
  addTask: (task: Omit<Task, "id">) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  
  // Tickets CRUD
  addTicket: (ticket: Ticket) => Promise<void>;
  updateTicket: (ticket: Ticket) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  addTicketWorkLog: (ticketId: string, myWork: string, myNote: string, date: string) => Promise<void>;
  ticketWorkLogs: TicketWorkLog[];

  // OEM Cases CRUD
  oemCases: OemCase[];
  loadingOemCases: boolean;
  addOemCase: (oemCase: Omit<OemCase, "id" | "agingDays">) => Promise<void>;
  updateOemCase: (oemCase: OemCase) => Promise<void>;
  deleteOemCase: (id: string) => Promise<void>;
  
  // Play/Pause Timer state
  activeTimers: Record<number, string>; // Maps taskId to startTime "HH:MM"
  startTimer: (taskId: number) => void;
  pauseTimer: (taskId: number) => void;
  stopTimer: (taskId: number) => void;

  // Products settings configuration
  products: string[];
  addProduct: (productName: string) => void;
  removeProduct: (productName: string) => void;

  // Categories settings configuration
  categories: string[];
  addCategory: (categoryName: string) => void;
  removeCategory: (categoryName: string) => void;

  // Personal profile configuration
  username: string;
  updateUsername: (name: string) => void;

  // Calendar shifts registry
  shiftsRegistry: ShiftType[];
  addShiftType: (name: string, timeRange: string) => void;
  removeShiftType: (name: string) => void;
  updateShiftType: (oldName: string, newName: string, timeRange: string) => void;

  // Calendar shift assignments
  shiftAssignments: Record<string, ShiftAssignment>;
  assignShift: (date: string, assignment: ShiftAssignment | null) => void;

  // OEM Configurable Dropdown Registries
  productCategories: string[];
  addProductCategory: (cat: string) => void;
  removeProductCategory: (cat: string) => void;

  caseTypes: string[];
  addCaseType: (type: string) => void;
  removeCaseType: (type: string) => void;

  statusUpdates: string[];
  addStatusUpdate: (status: string) => void;
  removeStatusUpdate: (status: string) => void;

  // Centralized Shift Roster State & Actions
  rosterMembers: RosterMember[];
  rosterAssignments: Record<string, string>;
  shiftPresets: ShiftPreset[];
  assignRosterShift: (employeeId: string, date: string, shiftCode: string) => void;
  bulkAssignRosterShifts: (employeeId: string, startDate: string, endDate: string, shiftCode: string) => void;
  saveRosterChanges: (changes: Record<string, string>) => Promise<void>;
  clearRosterMonth: (year: number, month: number) => Promise<void>;
  addShiftPreset: (preset: ShiftPreset) => void;
  removeShiftPreset: (code: string) => void;

  // Password Vault State & Actions
  vaultProducts: VaultProductGroup[];
  personalVault: PersonalVaultEntry[];
  masterPassword: string;
  updateMasterPassword: (newPin: string) => Promise<void>;
  personalVaultPin: string;
  updatePersonalVaultPin: (newPin: string) => Promise<void>;

  // Vault Recovery Kit (see AUTH.md "Password Vault Encryption")
  teamVaultRecoveryKitActive: boolean;
  personalVaultRecoveryKitActive: boolean;
  setupTeamVaultRecoveryKit: () => Promise<string | null>;
  setupPersonalVaultRecoveryKit: () => Promise<string | null>;
  recoverTeamVaultWithCode: (code: string, newPassword: string) => Promise<boolean>;
  recoverPersonalVaultWithCode: (code: string, newPin: string) => Promise<boolean>;
  resetTeamVault: (newPassword: string) => Promise<string | null>;
  resetPersonalVault: (newPin: string) => Promise<string | null>;

  // Vault Change Requests (member proposes a new field value, admin approves/rejects)
  vaultChangeRequests: VaultChangeRequest[];
  submitVaultChangeRequest: (entryId: string, fieldId: string, newValue: string, reason: string, secureUrl?: string) => Promise<boolean>;
  reviewVaultChangeRequest: (requestId: number, decision: "approved" | "rejected") => Promise<void>;

  addVaultProductGroup: (category: string, productName: string) => void;
  removeVaultProductGroup: (productId: string) => void;
  addVaultClientSection: (productId: string, clientId: string, clientName: string) => void;
  removeVaultClientSection: (productId: string, clientSectionId: string) => void;
  addVaultEntry: (productId: string, clientSectionId: string, entry: Omit<VaultEntry, "id" | "createdAt" | "updatedAt">) => void;
  updateVaultEntry: (productId: string, clientSectionId: string, entry: VaultEntry) => void;
  removeVaultEntry: (productId: string, clientSectionId: string, entryId: string) => void;
  addPersonalVaultEntry: (entry: Omit<PersonalVaultEntry, "id" | "createdAt" | "updatedAt" | "username">) => void;
  updatePersonalVaultEntry: (entry: PersonalVaultEntry) => void;
  removePersonalVaultEntry: (id: string) => void;

  // Auth User Details
  user: any | null;
  role: "admin" | "member";
  status: "active" | "disabled" | "pending";
  setStatus: (status: "active" | "disabled" | "pending") => void;
  employeeId: string;

  // Shift Requests Workflow
  shiftRequests: ShiftRequest[];
  submitShiftRequest: (dateStr: string, requestedShiftCode: string, reason: string) => Promise<boolean>;
  reviewShiftRequest: (requestId: number, status: "approved" | "declined") => Promise<void>;

  // Font configuration
  fontFamily: string;
  setFontFamily: (font: string) => void;
  accentTheme: string;
  setAccentTheme: (theme: string) => void;
}

export interface ShiftRequest {
  id: number;
  userId: string;
  employeeId: string;
  employeeName: string;
  dateStr: string;
  requestedShiftCode: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
}

const NestorContext = createContext<NestorContextType | undefined>(undefined);

// Time helpers
function getCurrentHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function calculateDiffMinutes(start: string, end: string): number {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  
  const startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  if (endMinutes < startMinutes) {
    // Crosses midnight
    endMinutes += 24 * 60;
  }
  
  return endMinutes - startMinutes;
}

interface DbTask {
  id: string | number;
  title: string;
  description?: string | null;
  category: string;
  status: string;
  duration_minutes: number;
  tags?: string[] | null;
  date: string;
  notes?: string | null;
  sessions?: string[] | null;
}

interface DbTicket {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  subject: string;
  details?: string | null;
  priority: string;
  status: string;
  product?: string | null;
  raised_by?: string | null;
  date: string;
  my_work?: string | null;
  my_note?: string | null;
  comments?: unknown;
}

const DEFAULT_PRODUCTS = [
  "Trellix AV",
  "Symantec AV",
  "Trend Vision AV",
  "Kaspersky AV",
  "Kaspersky EDR",
  "Kaspersky XDR",
  "enLight WAF",
  "Arcon PAM",
  "enLight PAM",
  "Aurva DAM",
  "enLight DAM",
  "Trellix DLP",
  "Symantec DLP",
  "GTB DLP",
];

const DEFAULT_CATEGORIES = [
  "Learning",
  "Meeting",
  "Operations",
  "Personal",
  "Research",
  "Documentation",
  "Automation",
  "Health Check",
];

const DEFAULT_SHIFTS: ShiftType[] = [
  { name: "Morning Shift", timeRange: "7 AM to 4 PM" },
  { name: "General Shift", timeRange: "10 AM to 7 PM" },
  { name: "Evening Shift", timeRange: "1 PM to 10 PM" },
  { name: "Night Shift", timeRange: "10 PM to 7 AM" }
];

const DEFAULT_PRODUCT_CATEGORIES = ["AV", "EDR", "XDR", "PAM", "DAM", "WAF", "DLP", "SIEM"];
const DEFAULT_CASE_TYPES = ["Feature Request", "Hash Blocking", "Issue", "Service Request", "Other"];
const DEFAULT_STATUS_UPDATES = ["Pending From OEM", "Pending Customer", "Issue Resolved", "Escalated", "In Progress"];

export function NestorProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [status, setStatus] = useState<"active" | "disabled" | "pending">("active");
  const [employeeId, setEmployeeId] = useState<string>("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketWorkLogs, setTicketWorkLogs] = useState<TicketWorkLog[]>([]);
  const [oemCases, setOemCases] = useState<OemCase[]>([]);
  const [loadingOemCases, setLoadingOemCases] = useState(true);

  // Toasts (surfaced save/sync errors, since most write paths fall back to
  // optimistic local state on failure and would otherwise fail silently)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (message: string, type: "error" | "success" = "error") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Team Password Vault is a centralized/shared module — only admins may
  // add, edit, or remove products/clients/credentials in it. Every
  // authenticated user can still read it. This is defense-in-depth on top
  // of the RLS policies, which enforce the same rule at the database level.
  const requireAdminForVault = (action: string): boolean => {
    if (role !== "admin") {
      showToast(`Only admins can ${action}. Ask an administrator to make this change.`);
      return false;
    }
    return true;
  };

  // Supabase/Postgrest error objects don't always render usefully through
  // console.error(label, errorObject) — some consoles/overlays print them as
  // "{}". Pull out the real fields explicitly instead, and surface the
  // actual message in the toast so the true cause (e.g. an RLS policy
  // rejection) isn't lost.
  const describeSupabaseError = (label: string, e: any): string => {
    const message = e?.message || (typeof e === "string" ? e : "") || "Unknown error";
    console.error(`${label}:`, message, "| code:", e?.code, "| hint:", e?.hint, "| details:", e?.details);
    return message;
  };

  // Listen for auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setRole("member");
        setStatus("active");
        setEmployeeId("");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setRole("member");
        setStatus("active");
        setEmployeeId("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Live Presence Tracking Heartbeat
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;

    const updatePresence = async () => {
      try {
        await supabase!
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", user.id);
      } catch (e) {
        console.error("Failed to update user presence heartbeat:", e);
      }
    };

    // Update immediately on user load
    updatePresence();

    // Heartbeat every 2 minutes
    const intervalId = setInterval(updatePresence, 2 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [user]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase!
        .from("profiles")
        .select("role, status, employee_id, username")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setRole(data.role as "admin" | "member");
        setStatus(data.status as "active" | "disabled" | "pending");
        setEmployeeId(data.employee_id || userId);
        if (data.username) {
          setUsername(data.username);
        }
      }
    } catch (e) {
      console.error("Error loading user profile:", e);
    }
  };

  // Font family state
  const [fontFamily, setFontFamilyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nestor_font_family") || "Inter";
    }
    return "Inter";
  });

  const setFontFamily = (font: string) => {
    setFontFamilyState(font);
    if (typeof window !== "undefined") {
      localStorage.setItem("nestor_font_family", font);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fontMap: Record<string, string> = {
      "Inter": "var(--font-inter), sans-serif",
      "Roboto": "'Roboto', sans-serif",
      "Lato": "'Lato', sans-serif",
      "Outfit": "'Outfit', sans-serif",
      "Poppins": "'Poppins', sans-serif",
      "Merriweather": "'Merriweather', serif",
      "Times New Roman": "'Times New Roman', Times, serif",
      "Fira Code": "'Fira Code', monospace",
      "Courier New": "'Courier New', Courier, monospace",
      "Playfair Display": "'Playfair Display', serif"
    };
    const familyStr = fontMap[fontFamily] || "var(--font-inter), sans-serif";
    document.body.style.fontFamily = familyStr;
  }, [fontFamily]);

  // Accent theme — swaps the --color-accent-purple/--color-accent-cyan CSS
  // variables (defined per-value in tokens.css under [data-accent="..."])
  // that drive nearly every gradient/highlight in the app, without touching
  // layout or the (currently forced-dark-only) light/dark mode.
  const [accentTheme, setAccentThemeState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nestor_accent_theme") || "default";
    }
    return "default";
  });

  const setAccentTheme = (theme: string) => {
    setAccentThemeState(theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("nestor_accent_theme", theme);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-accent", accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      root.classList.remove("light");
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    }
  }, []);
  const [products, setProducts] = useState<string[]>(DEFAULT_PRODUCTS);

  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const addCategory = (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      return updated;
    });
  };

  const removeCategory = (categoryName: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c !== categoryName);
      return updated;
    });
  };

  const [username, setUsername] = useState<string>("Boss");

  // OEM Configurable Dropdown Registries
  const [productCategories, setProductCategories] = useState<string[]>(DEFAULT_PRODUCT_CATEGORIES);

  const [caseTypes, setCaseTypes] = useState<string[]>(DEFAULT_CASE_TYPES);

  const [statusUpdates, setStatusUpdates] = useState<string[]>(DEFAULT_STATUS_UPDATES);

  // Centralized Shift Roster states
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>(initialRosterMembers);

  const [rosterAssignments, setRosterAssignments] = useState<Record<string, string>>(generateInitialAssignments());

  const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>(initialShiftPresets);

  // Password Vault States
  const [vaultProducts, setVaultProducts] = useState<VaultProductGroup[]>(initialVaultProducts);

  const [personalVault, setPersonalVault] = useState<PersonalVaultEntry[]>(initialPersonalVault);

  const [vaultChangeRequests, setVaultChangeRequests] = useState<VaultChangeRequest[]>([]);

  const [masterPassword, setMasterPasswordState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nestor_master_password") || "1234";
    }
    return "1234";
  });

  // Personal Vault PIN — deliberately separate from the team master password
  // above. It's the passphrase that keys each user's own personal-vault
  // encryption, so one user's PIN (or an admin rotating the team password)
  // never affects anyone else's personal vault. Stored per-user in
  // localStorage; keyed by employeeId so it survives across sessions on the
  // same device without ever leaving the browser.
  const [personalVaultPin, setPersonalVaultPinState] = useState<string>("1234");

  // Whether personalVaultPin has been checked against localStorage yet.
  // employeeId is only known after the profile loads (async), so there is a
  // real window right after login where personalVaultPin still holds its
  // hardcoded "1234" default even though the user previously set a custom
  // PIN. Any encrypt/decrypt attempted in that window uses the wrong key —
  // this caused entries added (or loaded) during that window to look
  // "undecryptable" moments later once the real PIN loaded. Every personal
  // vault read/write below must wait for this flag before touching crypto.
  const [personalVaultPinHydrated, setPersonalVaultPinHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupabaseConfigured) {
      // Local-only mode never reads a server-synced PIN, nothing to wait for.
      setPersonalVaultPinHydrated(true);
      return;
    }
    if (!employeeId) return; // still waiting on the profile fetch — stay un-hydrated
    const stored = localStorage.getItem(`nestor_personal_vault_pin_${employeeId}`);
    if (stored) setPersonalVaultPinState(stored);
    setPersonalVaultPinHydrated(true);
  }, [employeeId]);

  // Guard for every Personal Vault encrypt/decrypt-touching write. Refusing
  // to proceed (rather than silently using a possibly-stale PIN) is what
  // actually fixes the "just-added entry can't be decrypted" bug — encrypting
  // with the wrong key succeeds silently at write time and only surfaces as
  // a failure later, on the next load.
  const requirePersonalVaultReady = (): boolean => {
    if (isSupabaseConfigured && !personalVaultPinHydrated) {
      showToast("Your personal vault is still loading — please wait a moment and try again.");
      return false;
    }
    return true;
  };

  // Cached derived AES-GCM keys, so PBKDF2 (intentionally expensive) only
  // reruns when the underlying passphrase actually changes, not once per
  // field on every render/load.
  const teamKeyCacheRef = useRef<{ passphrase: string; key: CryptoKey } | null>(null);
  const personalKeyCacheRef = useRef<{ passphrase: string; key: CryptoKey } | null>(null);

  // Whether each scope has been migrated to the Recovery Kit (wrapped DEK)
  // model yet — see AUTH.md "Password Vault Encryption". Until a scope's
  // Recovery Kit is set up, its entries are still encrypted directly with
  // the passphrase-derived key (the original, simpler scheme), exactly as
  // before this feature existed.
  const [teamVaultRecoveryKitActive, setTeamVaultRecoveryKitActive] = useState(false);
  const [personalVaultRecoveryKitActive, setPersonalVaultRecoveryKitActive] = useState(false);

  // Resolves the actual key used to encrypt/decrypt Team Vault entries.
  // If a Recovery Kit has been set up (a vault_key_wraps row exists), that
  // means entries are encrypted under a random DEK — unwrap it using the
  // current passphrase. Otherwise, fall back to the original direct
  // passphrase-derived key (pre-Recovery-Kit / not-yet-migrated scopes).
  const getTeamVaultKey = async (): Promise<CryptoKey> => {
    if (teamKeyCacheRef.current?.passphrase === masterPassword) {
      return teamKeyCacheRef.current.key;
    }
    const passphraseKey = await deriveVaultKey(masterPassword, "team");
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("vault_key_wraps")
        .select("wrapped_dek_passphrase")
        .eq("id", "team")
        .maybeSingle();
      if (data?.wrapped_dek_passphrase) {
        setTeamVaultRecoveryKitActive(true);
        const dek = await unwrapDataEncryptionKey(passphraseKey, data.wrapped_dek_passphrase as EncryptedEnvelope);
        teamKeyCacheRef.current = { passphrase: masterPassword, key: dek };
        return dek;
      }
      setTeamVaultRecoveryKitActive(false);
    }
    teamKeyCacheRef.current = { passphrase: masterPassword, key: passphraseKey };
    return passphraseKey;
  };

  // Same resolution as getTeamVaultKey, scoped to the current user's
  // Personal Vault.
  const getPersonalVaultKey = async (): Promise<CryptoKey> => {
    const scopedPassphrase = `${employeeId || "local"}:${personalVaultPin}`;
    if (personalKeyCacheRef.current?.passphrase === scopedPassphrase) {
      return personalKeyCacheRef.current.key;
    }
    const passphraseKey = await deriveVaultKey(personalVaultPin, `personal:${employeeId || "local"}`);
    if (isSupabaseConfigured && supabase && user) {
      const { data } = await supabase
        .from("vault_key_wraps")
        .select("wrapped_dek_passphrase")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.wrapped_dek_passphrase) {
        setPersonalVaultRecoveryKitActive(true);
        const dek = await unwrapDataEncryptionKey(passphraseKey, data.wrapped_dek_passphrase as EncryptedEnvelope);
        personalKeyCacheRef.current = { passphrase: scopedPassphrase, key: dek };
        return dek;
      }
      setPersonalVaultRecoveryKitActive(false);
    }
    personalKeyCacheRef.current = { passphrase: scopedPassphrase, key: passphraseKey };
    return passphraseKey;
  };

  const updateUsername = (name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      setUsername(trimmed);
    }
  };

  const [shiftsRegistry, setShiftsRegistry] = useState<ShiftType[]>(DEFAULT_SHIFTS);

  const addShiftType = (name: string, timeRange: string) => {
    const trimmedName = name.trim();
    const trimmedRange = timeRange.trim();
    if (!trimmedName || !trimmedRange) return;
    setShiftsRegistry((prev) => {
      if (prev.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) return prev;
      const updated = [...prev, { name: trimmedName, timeRange: trimmedRange }];
      return updated;
    });
  };

  const removeShiftType = (name: string) => {
    setShiftsRegistry((prev) => {
      const updated = prev.filter((s) => s.name !== name);
      return updated;
    });
  };

  const updateShiftType = (oldName: string, newName: string, timeRange: string) => {
    const trimmedName = newName.trim();
    const trimmedRange = timeRange.trim();
    if (!trimmedName) return;
    setShiftsRegistry((prev) => {
      const updated = prev.map((s) =>
        s.name === oldName ? { name: trimmedName, timeRange: trimmedRange } : s
      );
      return updated;
    });
  };

  const [shiftAssignments, setShiftAssignments] = useState<Record<string, ShiftAssignment>>({});

  // shiftAssignments is legacy, no-backend-mode-only state — it has no
  // Supabase loader and is never scoped by user. Without this, whatever a
  // previous account wrote here (via assignShift) stays in memory and can
  // leak into a different account's calendar if a second user logs in within
  // the same browser tab/session without a full page reload. Clearing it on
  // every auth change closes that leak regardless of which account is next.
  useEffect(() => {
    setShiftAssignments({});
  }, [user]);

  const assignShift = (date: string, assignment: ShiftAssignment | null) => {
    setShiftAssignments((prev) => {
      const updated = { ...prev };
      if (assignment === null) {
        delete updated[date];
      } else {
        updated[date] = assignment;
      }
      return updated;
    });
  };

  const addProduct = (productName: string) => {
    const trimmed = productName.trim();
    if (!trimmed) return;
    setProducts((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      return updated;
    });
  };

  const removeProduct = (productName: string) => {
    setProducts((prev) => {
      const updated = prev.filter((p) => p !== productName);
      return updated;
    });
  };
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  
  const [activeTimers, setActiveTimers] = useState<Record<number, string>>({});

  const saveActiveTimers = (timers: Record<number, string>) => {
    setActiveTimers(timers);
  };

  // Load Tasks
  useEffect(() => {
    async function loadTasks() {
      if (isSupabaseConfigured && supabase && user) {
        try {
          const { data, error } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("id", { ascending: true });
          
          if (error) throw error;
          
          if (data) {
            // Map db snake_case to camelCase
            const mapped: Task[] = (data as DbTask[]).map((t) => ({
              id: Number(t.id),
              title: t.title,
              description: t.description || "",
              category: t.category as TaskCategory,
              status: t.status as TaskStatus,
              durationMinutes: t.duration_minutes,
              tags: t.tags || [],
              date: t.date,
              notes: t.notes || "",
              sessions: t.sessions || [],
            }));
            setTasks(mapped);
          }
        } catch (e: any) {
          console.error("Supabase tasks fetch error, loading from local:", e?.message || e);
                  } finally {
          setLoadingTasks(false);
        }
      } else {
        setLoadingTasks(false);
      }
    }

    loadTasks();
  }, [user]);

  // Load Tickets
  useEffect(() => {
    async function loadTickets() {
      if (isSupabaseConfigured && supabase && user) {
        try {
          // Load user's ticket metadata
          const { data, error } = await supabase
            .from("tickets")
            .select("*")
            .eq("user_id", user.id)
            .order("date", { ascending: false });
          
          if (error) throw error;
          
          // Load user's work logs for tickets
          const { data: logsData } = await supabase
            .from("ticket_work_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          const mappedLogs: TicketWorkLog[] = (logsData || []).map((l: any) => ({
            id: Number(l.id),
            ticketId: l.ticket_id,
            userId: l.user_id,
            authorName: l.author_name || "",
            date: l.date,
            myWork: l.my_work || "",
            myNote: l.my_note || "",
            createdAt: l.created_at,
          }));
          setTicketWorkLogs(mappedLogs);
          
          if (data) {
            const logsByTicket: Record<string, TicketWorkLog[]> = {};
            mappedLogs.forEach((log) => {
              if (!logsByTicket[log.ticketId]) logsByTicket[log.ticketId] = [];
              logsByTicket[log.ticketId].push(log);
            });

            const mapped: Ticket[] = (data as any[]).map((t) => {
              const logs = logsByTicket[t.id] || [];
              const latestLog = logs[0];
              return {
                id: t.id,
                customerId: t.customer_id || "",
                customerName: t.customer_name || "",
                subject: t.subject,
                details: t.details || "",
                priority: t.priority as TicketPriority,
                status: t.status as TicketStatus,
                product: t.product || "",
                raisedBy: t.raised_by || "",
                date: t.date,
                myWork: latestLog?.myWork || t.my_work || "",
                myNote: latestLog?.myNote || t.my_note || "",
                comments: (t.comments as any) || [],
                workLogs: logs,
              };
            });
            setTickets(mapped);
          }
        } catch (e: any) {
          console.error("Supabase tickets fetch error, loading from local:", e?.message || e);
                  } finally {
          setLoadingTickets(false);
        }
      } else {
        setLoadingTickets(false);
      }
    }

    loadTickets();
  }, [user]);

  // Load OEM Cases
  useEffect(() => {
    async function loadOemCases() {
      if (isSupabaseConfigured && supabase && user) {
        try {
          const { data, error } = await supabase
            .from("oem_cases")
            .select("*")
            .order("created_date", { ascending: false });
          
          if (error) throw error;
          if (data) {
            const mapped: OemCase[] = data.map((c) => ({
              id: c.id,
              productName: c.product_name || "",
              productCategory: c.product_category || "",
              clientId: c.client_id || "",
              clientName: c.client_name || "",
              caseType: c.case_type || "",
              oemCaseId: c.oem_case_id || c.case_id || "",
              internalTicketId: c.internal_ticket_id || "",
              title: c.title || "",
              description: c.description || "",
              priority: (c.priority || c.severity || "P3") as any,
              assignedTo: c.assigned_to || c.assigned_engineer || "",
              raisedBy: c.raised_by || "",
              createdDate: c.created_date || c.date_opened || "",
              updatedDate: c.updated_date || c.date_updated || "",
              statusUpdate: c.status_update || c.status || "",
              closureDate: c.closure_date || null,
              agingDays: calculateAging(c.created_date || c.date_opened),
              notes: c.notes || "",
            }));
            setOemCases(mapped);
          }
        } catch (e: any) {
          console.error("Supabase OEM cases fetch error, loading from local:", e?.message || e?.code || JSON.stringify(e) || e);
                  } finally {
          setLoadingOemCases(false);
        }
      } else {
        setLoadingOemCases(false);
      }
    }

    function calculateAging(openDateStr: string): number {
      if (!openDateStr) return 0;
      const opened = new Date(openDateStr);
      const today = new Date();
      const diff = today.getTime() - opened.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }

    loadOemCases();
  }, [user]);

  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([]);

  // Load Shift Roster & Shift Requests
  useEffect(() => {
    async function loadRosterAndRequests() {
      if (isSupabaseConfigured && supabase && user) {
        // 1. Fetch Roster Members from active profiles
        try {
          const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("id, employee_id, username, role")
            .eq("status", "active");

          if (profileErr) throw profileErr;
          if (profileData) {
            const mappedMembers: RosterMember[] = profileData.map((p) => ({
              employeeId: p.employee_id || p.id,
              name: p.username || "Unknown",
              role: p.role === "admin" ? "Admin" : "MSS Engineer",
              department: "MSS Team",
            }));
            setRosterMembers(mappedMembers);
          }
        } catch (e) {
          console.error("Error loading roster members:", e);
        }

        // 2. Fetch Roster Assignments
        try {
          const { data: assignData, error: assignErr } = await supabase
            .from("roster_assignments")
            .select("employee_id, date_str, shift_code");

          if (assignErr) throw assignErr;
          if (assignData) {
            const record: Record<string, string> = {};
            assignData.forEach((a) => {
              record[`${a.employee_id}_${a.date_str}`] = a.shift_code;
            });
            setRosterAssignments(record);
          }
        } catch (e) {
          console.error("Error loading roster assignments:", e);
        }

        // 3. Fetch Shift Requests
        try {
          const { data: requestData, error: requestErr } = await supabase
            .from("shift_requests")
            .select("*")
            .order("created_at", { ascending: false });

          if (requestErr) throw requestErr;
          if (requestData) {
            const mappedRequests: ShiftRequest[] = requestData.map((r) => ({
              id: Number(r.id),
              userId: r.user_id,
              employeeId: r.employee_id,
              employeeName: r.employee_name,
              dateStr: r.date_str,
              requestedShiftCode: r.requested_shift_code,
              reason: r.reason || "",
              status: r.status as any,
              createdAt: r.created_at,
            }));
            setShiftRequests(mappedRequests);
          }
        } catch (e) {
          console.error("Error loading shift requests:", e);
        }
      }
    }

    loadRosterAndRequests();
  }, [user]);

  // Load Password Vault
  useEffect(() => {
    async function loadVault() {
      if (isSupabaseConfigured && supabase && user) {
        // Load Team Vault
        try {
          const { data: dbProds } = await supabase.from("vault_products").select("*");
          const { data: dbClients } = await supabase.from("vault_clients").select("*");
          const { data: dbEntries } = await supabase.from("vault_entries").select("*");

          if (dbProds) {
            const teamKey = await getTeamVaultKey();
            const decryptedEntries = await Promise.all(
              (dbEntries || []).map(async (e) => {
                let fields: VaultField[] = [];
                let notes = "";
                if (isEncryptedEnvelope(e.fields)) {
                  try {
                    const payload = await decryptVaultPayload<{ fields: VaultField[]; notes: string }>(teamKey, e.fields);
                    fields = payload.fields || [];
                    notes = payload.notes || "";
                  } catch (err) {
                    // The resolved key (DEK, if a Recovery Kit wrap exists) failed —
                    // this entry may not have been migrated yet (e.g. an
                    // interrupted Recovery Kit setup/reset). Fall back to the
                    // direct passphrase-derived key before giving up, so a
                    // partial migration doesn't strand individual entries.
                    try {
                      const directKey = await deriveVaultKey(masterPassword, "team");
                      const payload = await decryptVaultPayload<{ fields: VaultField[]; notes: string }>(directKey, e.fields);
                      fields = payload.fields || [];
                      notes = payload.notes || "";
                    } catch (err2) {
                      // Both the resolved key and the direct passphrase key failed —
                      // this specific entry is undecryptable with any key currently
                      // known (most likely orphaned data from before a password/PIN
                      // change or Recovery Kit operation). This is handled
                      // gracefully below (shown as "[Unable to decrypt]"), not a
                      // crash, so this is a warning, not an error.
                      console.warn("Failed to decrypt vault entry (wrong master password, or orphaned pre-change data):", err2);
                      notes = "[Unable to decrypt — check the team master password]";
                    }
                  }
                } else if (Array.isArray(e.fields)) {
                  // Legacy unencrypted rows written before encryption was added.
                  fields = e.fields;
                  notes = e.notes || "";
                }
                return {
                  id: e.id,
                  product_id: e.product_id,
                  client_id: e.client_id,
                  label: e.label || e.title || "",
                  addedBy: e.added_by || "Admin",
                  createdAt: e.created_at || new Date().toISOString(),
                  updatedAt: e.updated_at || new Date().toISOString(),
                  notes,
                  fields,
                };
              })
            );

            const mapped: VaultProductGroup[] = dbProds.map((p) => {
              const clientsForProd = (dbClients || [])
                .filter((c) => c.product_id === p.id)
                .map((c) => {
                  const entriesForClient = decryptedEntries
                    .filter((e) => e.product_id === p.id && e.client_id === c.id)
                    .map(({ product_id, client_id, ...entry }) => entry);

                  return {
                    id: c.id,
                    clientId: c.client_id,
                    clientName: c.client_name,
                    entries: entriesForClient,
                  };
                });

              return {
                id: p.id,
                category: p.category,
                productName: p.product_name,
                clients: clientsForProd,
              };
            });
            setVaultProducts(mapped);

            const undecryptableCount = decryptedEntries.filter((e) => e.notes.startsWith("[Unable to decrypt")).length;
            if (undecryptableCount > 0) {
              showToast(
                `${undecryptableCount} team vault credential set${undecryptableCount === 1 ? "" : "s"} couldn't be decrypted with the current master password — likely leftover data from before a password change. They'll need to be deleted and re-created.`
              );
            }
          }
        } catch (e) {
          console.error("Error loading team vault from Supabase:", e);
        }

        // Load Personal Vault — wait for personalVaultPinHydrated so this
        // never runs against the stale "1234" default before the user's real
        // stored PIN has had a chance to load (see the flag's own comment).
        try {
          const { data: dbPers } = personalVaultPinHydrated
            ? await supabase.from("personal_vault").select("*").eq("user_id", user.id)
            : { data: null };

          if (dbPers) {
            const personalKey = await getPersonalVaultKey();
            const mapped: PersonalVaultEntry[] = await Promise.all(
              dbPers.map(async (e) => {
                let fields: VaultField[] = [];
                let notes = "";
                if (isEncryptedEnvelope(e.fields)) {
                  try {
                    const payload = await decryptVaultPayload<{ fields: VaultField[]; notes: string }>(personalKey, e.fields);
                    fields = payload.fields || [];
                    notes = payload.notes || "";
                  } catch (err) {
                    // Same fallback as the team vault: the resolved key may be
                    // a DEK while this particular entry wasn't migrated yet.
                    try {
                      const directKey = await deriveVaultKey(personalVaultPin, `personal:${employeeId || "local"}`);
                      const payload = await decryptVaultPayload<{ fields: VaultField[]; notes: string }>(directKey, e.fields);
                      fields = payload.fields || [];
                      notes = payload.notes || "";
                    } catch (err2) {
                      // Same reasoning as the team vault fallback above: both
                      // keys failed, this entry is undecryptable with anything
                      // currently known — handled gracefully, so this is a
                      // warning, not an error.
                      console.warn("Failed to decrypt personal vault entry (wrong personal PIN, or orphaned pre-change data):", err2);
                      notes = "[Unable to decrypt — check your personal vault PIN]";
                    }
                  }
                } else if (Array.isArray(e.fields)) {
                  fields = e.fields;
                  notes = e.notes || "";
                }
                return {
                  id: e.id,
                  label: e.label || e.title || "",
                  notes,
                  fields,
                  username: e.username || "Me",
                  createdAt: e.created_at || new Date().toISOString(),
                  updatedAt: e.updated_at || new Date().toISOString(),
                };
              })
            );
            setPersonalVault(mapped);

            const undecryptableCount = mapped.filter((e) => (e.notes || "").startsWith("[Unable to decrypt")).length;
            if (undecryptableCount > 0) {
              showToast(
                `${undecryptableCount} personal vault entr${undecryptableCount === 1 ? "y" : "ies"} couldn't be decrypted with the current PIN — likely leftover data from before a PIN change. They'll need to be deleted and re-created.`
              );
            }
          }
        } catch (e) {
          console.error("Error loading personal vault from Supabase:", e);
        }
      }
    }

    loadVault();
  }, [user, masterPassword, personalVaultPin, personalVaultPinHydrated]);

  // Decrypts a vault_change_requests.new_value column value. Current rows
  // store `JSON.stringify(EncryptedEnvelope)` (encrypted under the Team Vault
  // key — see decryptVaultChangeRequestValue's caller). Older rows written
  // before this fix hold plain text directly; those are read as-is so
  // pre-existing requests don't break, but every new submission is encrypted.
  const decryptVaultChangeRequestValue = async (
    raw: string
  ): Promise<{ value: string; url?: string; locked: boolean }> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { value: raw, locked: false }; // legacy plaintext row
    }
    if (!isEncryptedEnvelope(parsed)) {
      return { value: raw, locked: false };
    }
    try {
      const teamKey = await getTeamVaultKey();
      const payload = await decryptVaultPayload<{ value: string; url?: string }>(teamKey, parsed);
      return { value: payload.value, url: payload.url, locked: false };
    } catch {
      return { value: "", locked: true };
    }
  };

  // Load Vault Change Requests — RLS already scopes this to "my own requests"
  // for members and "every request" for admins, so a plain select("*") is
  // correct for both roles without any client-side filtering.
  useEffect(() => {
    async function loadVaultChangeRequests() {
      if (!isSupabaseConfigured || !supabase || !user) return;
      try {
        const { data, error } = await supabase
          .from("vault_change_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (data) {
          const decrypted = await Promise.all(
            data.map(async (r) => {
              const { value, url, locked } = await decryptVaultChangeRequestValue(r.new_value);
              return {
                id: Number(r.id),
                userId: r.user_id,
                requesterName: r.requester_name || "User",
                entryId: r.entry_id,
                fieldId: r.field_id,
                newValue: locked ? "🔒 Unlock the Team Vault to view this value" : value,
                secureUrl: url,
                reason: r.reason || "",
                status: r.status as VaultChangeRequest["status"],
                createdAt: r.created_at,
                reviewedBy: r.reviewed_by,
                reviewedAt: r.reviewed_at,
              };
            })
          );
          setVaultChangeRequests(decrypted);
        }
      } catch (e) {
        console.error("Error loading vault change requests:", e);
      }
    }

    loadVaultChangeRequests();
  }, [user, masterPassword]);

  // Save Local helper
  const saveTasksLocal = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  };

  const saveTicketsLocal = (updatedTickets: Ticket[]) => {
    setTickets(updatedTickets);
  };

  // Add Task
  const addTask = async (taskInput: Omit<Task, "id">) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: user.id,
            title: taskInput.title,
            description: taskInput.description,
            category: taskInput.category,
            status: taskInput.status,
            duration_minutes: taskInput.durationMinutes,
            tags: taskInput.tags,
            date: taskInput.date,
            notes: taskInput.notes,
            sessions: taskInput.sessions,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const newTask: Task = {
            id: Number(data.id),
            title: data.title,
            description: data.description || "",
            category: data.category,
            status: data.status,
            durationMinutes: data.duration_minutes,
            tags: data.tags || [],
            date: data.date,
            notes: data.notes || "",
            sessions: data.sessions || [],
          };
          setTasks((prev) => [...prev, newTask]);
        }
      } catch (e: any) {
        console.error("Supabase task insert error, inserting locally:", e?.message || e);
        showToast("Couldn't save task to the server — saved locally only.");
        insertTaskLocal(taskInput);
      }
    } else {
      insertTaskLocal(taskInput);
    }
  };

  const insertTaskLocal = (taskInput: Omit<Task, "id">) => {
    const newId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
    const newTask: Task = { ...taskInput, id: newId };
    saveTasksLocal([...tasks, newTask]);
  };

  // Update Task
  const updateTask = async (task: Task) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({
            title: task.title,
            description: task.description,
            category: task.category,
            status: task.status,
            duration_minutes: task.durationMinutes,
            tags: task.tags,
            date: task.date,
            notes: task.notes,
            sessions: task.sessions,
          })
          .eq("id", task.id);

        if (error) throw error;
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      } catch (e: any) {
        console.error("Supabase task update error, updating locally:", e?.message || e);
        showToast("Couldn't save task changes to the server — saved locally only.");
        updateTaskLocal(task);
      }
    } else {
      updateTaskLocal(task);
    }
  };

  const updateTaskLocal = (task: Task) => {
    const updated = tasks.map((t) => (t.id === task.id ? task : t));
    saveTasksLocal(updated);
  };

  // Delete Task
  const deleteTask = async (id: number) => {
    // Clean up timer if active
    if (activeTimers[id]) {
      const nextTimers = { ...activeTimers };
      delete nextTimers[id];
      saveActiveTimers(nextTimers);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (e: any) {
        console.error("Supabase task delete error, deleting locally:", e?.message || e);
        showToast("Couldn't delete task on the server — removed locally only.");
        deleteTaskLocal(id);
      }
    } else {
      deleteTaskLocal(id);
    }
  };

  const deleteTaskLocal = (id: number) => {
    saveTasksLocal(tasks.filter((t) => t.id !== id));
  };

  // Add Ticket — upserts shared ticket metadata, always inserts a fresh work log for current user
  const addTicket = async (ticket: Ticket) => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        // UPSERT ticket metadata (no duplicate key error if ticket already exists)
        const { error: upsertError } = await supabase.from("tickets").upsert(
          {
            id: ticket.id,
            user_id: user.id,
            customer_id: ticket.customerId,
            customer_name: ticket.customerName,
            subject: ticket.subject,
            details: ticket.details,
            priority: ticket.priority,
            status: ticket.status,
            product: ticket.product,
            raised_by: ticket.raisedBy,
            date: ticket.date,
            my_work: ticket.myWork,
            my_note: ticket.myNote || "",
            comments: ticket.comments,
          },
          { onConflict: "id, user_id" }
        );
        if (upsertError) throw upsertError;

        // Always insert a new work log entry for the current user (if they did any work)
        if (ticket.myWork || ticket.myNote) {
          const { data: logData, error: logError } = await supabase
            .from("ticket_work_logs")
            .insert({
              ticket_id: ticket.id,
              user_id: user.id,
              author_name: username || user.email || "Unknown",
              date: ticket.date,
              my_work: ticket.myWork || "",
              my_note: ticket.myNote || "",
            })
            .select()
            .single();

          if (!logError && logData) {
            const newLog: TicketWorkLog = {
              id: Number(logData.id),
              ticketId: ticket.id,
              userId: logData.user_id,
              authorName: logData.author_name,
              date: logData.date,
              myWork: logData.my_work,
              myNote: logData.my_note,
              createdAt: logData.created_at,
            };
            setTicketWorkLogs((prev) => [newLog, ...prev]);
            setTickets((prev) => {
              const exists = prev.find((t) => t.id === ticket.id);
              if (exists) {
                return prev.map((t) =>
                  t.id === ticket.id
                    ? { ...t, ...ticket, workLogs: [newLog, ...(t.workLogs || [])], myWork: ticket.myWork, myNote: ticket.myNote }
                    : t
                );
              }
              return [{ ...ticket, workLogs: [newLog] }, ...prev];
            });
            return;
          }
        }

        // No work logged — just add/update ticket in state
        setTickets((prev) => {
          const exists = prev.find((t) => t.id === ticket.id);
          if (exists) return prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t));
          return [ticket, ...prev];
        });
      } catch (e: any) {
        console.error("Supabase ticket insert error, inserting locally:", e?.message || e);
        showToast("Couldn't save ticket to the server — saved locally only.");
        insertTicketLocal(ticket);
      }
    } else {
      insertTicketLocal(ticket);
    }
  };

  // Add a work log entry to an existing ticket
  const addTicketWorkLog = async (ticketId: string, myWork: string, myNote: string, date: string) => {
    const newLogLocal: TicketWorkLog = {
      id: Date.now(),
      ticketId,
      userId: user?.id || "local",
      authorName: username || "Me",
      date,
      myWork,
      myNote,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && user) {
      try {
        const { data, error } = await supabase
          .from("ticket_work_logs")
          .insert({
            ticket_id: ticketId,
            user_id: user.id,
            author_name: username || user.email || "Unknown",
            date,
            my_work: myWork,
            my_note: myNote,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const saved: TicketWorkLog = {
            id: Number(data.id),
            ticketId: data.ticket_id,
            userId: data.user_id,
            authorName: data.author_name,
            date: data.date,
            myWork: data.my_work,
            myNote: data.my_note,
            createdAt: data.created_at,
          };
          setTicketWorkLogs((prev) => [saved, ...prev]);
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId
                ? { ...t, workLogs: [saved, ...(t.workLogs || [])], myWork: saved.myWork, myNote: saved.myNote }
                : t
            )
          );
          return;
        }
      } catch (e: any) {
        console.error("Supabase work log insert error:", e?.message || e);
        showToast("Couldn't save work log to the server — saved locally only.");
      }
    }
    // Local fallback
    setTicketWorkLogs((prev) => [newLogLocal, ...prev]);
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, workLogs: [newLogLocal, ...(t.workLogs || [])], myWork, myNote }
          : t
      )
    );
  };

  const insertTicketLocal = (ticket: Ticket) => {
    const exists = tickets.some((t) => t.id.toLowerCase() === ticket.id.toLowerCase());
    if (exists) {
      updateTicketLocal(ticket);
    } else {
      saveTicketsLocal([ticket, ...tickets]);
    }
  };

  // Update Ticket
  const updateTicket = async (ticket: Ticket) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("tickets")
          .update({
            customer_id: ticket.customerId,
            customer_name: ticket.customerName,
            subject: ticket.subject,
            details: ticket.details,
            priority: ticket.priority,
            status: ticket.status,
            product: ticket.product,
            raised_by: ticket.raisedBy,
            date: ticket.date,
            my_work: ticket.myWork,
            my_note: ticket.myNote || "",
            comments: ticket.comments,
          })
          .eq("id", ticket.id);

        if (error) throw error;
        setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
      } catch (e: any) {
        console.error("Supabase ticket update error, updating locally:", e?.message || e);
        showToast("Couldn't save ticket changes to the server — saved locally only.");
        updateTicketLocal(ticket);
      }
    } else {
      updateTicketLocal(ticket);
    }
  };

  const updateTicketLocal = (ticket: Ticket) => {
    const updated = tickets.map((t) => (t.id === ticket.id ? ticket : t));
    saveTicketsLocal(updated);
  };

  // Delete Ticket
  const deleteTicket = async (id: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        // Explicitly clear work log entries first (belt-and-suspenders alongside the
        // ticket_work_logs.ticket_id ON DELETE CASCADE FK) so no orphaned rows remain
        // regardless of which database this runs against.
        const { error: workLogError } = await supabase
          .from("ticket_work_logs")
          .delete()
          .eq("ticket_id", id);
        if (workLogError) throw workLogError;

        const { error } = await supabase.from("tickets").delete().eq("id", id);
        if (error) throw error;
        setTickets((prev) => prev.filter((t) => t.id !== id));
        setTicketWorkLogs((prev) => prev.filter((l) => l.ticketId !== id));
      } catch (e: any) {
        console.error("Supabase ticket delete error, deleting locally:", e?.message || e);
        showToast("Couldn't delete ticket on the server — removed locally only.");
        deleteTicketLocal(id);
      }
    } else {
      deleteTicketLocal(id);
    }
  };

  const deleteTicketLocal = (id: string) => {
    saveTicketsLocal(tickets.filter((t) => t.id !== id));
    setTicketWorkLogs((prev) => prev.filter((l) => l.ticketId !== id));
  };

  // Timer: Start Play session
  const startTimer = (taskId: number) => {
    const startTime = getCurrentHHMM();
    const updatedTimers = { ...activeTimers, [taskId]: startTime };
    saveActiveTimers(updatedTimers);

    // Automatically transition status to "in-progress" if it was "pending"
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask && targetTask.status === "pending") {
      updateTask({ ...targetTask, status: "in-progress" });
    }
  };

  // Timer: Pause session and log duration
  const pauseTimer = (taskId: number) => {
    const startTime = activeTimers[taskId];
    if (!startTime) return;

    const endTime = getCurrentHHMM();
    const duration = calculateDiffMinutes(startTime, endTime);
    
    // Remove timer
    const updatedTimers = { ...activeTimers };
    delete updatedTimers[taskId];
    saveActiveTimers(updatedTimers);

    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask) {
      const sessionString = `${startTime}-${endTime}`;
      const updatedSessions = [...targetTask.sessions, sessionString];
      const updatedDuration = targetTask.durationMinutes + duration;
      
      updateTask({
        ...targetTask,
        durationMinutes: updatedDuration,
        sessions: updatedSessions,
      });
    }
  };

  // Timer: Stop tracking and mark completed
  const stopTimer = (taskId: number) => {
    const startTime = activeTimers[taskId];
    
    let durationToAdd = 0;
    let newSessions: string[] = [];
    
    if (startTime) {
      const endTime = getCurrentHHMM();
      durationToAdd = calculateDiffMinutes(startTime, endTime);
      newSessions = [`${startTime}-${endTime}`];
      
      // Remove timer
      const updatedTimers = { ...activeTimers };
      delete updatedTimers[taskId];
      saveActiveTimers(updatedTimers);
    }

    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask) {
      updateTask({
        ...targetTask,
        status: "completed",
        durationMinutes: targetTask.durationMinutes + durationToAdd,
        sessions: [...targetTask.sessions, ...newSessions],
      });
    }
  };

  return (
    <NestorContext.Provider
      value={{
        tasks,
        tickets,
        loadingTasks,
        loadingTickets,
        isSupabaseActive: isSupabaseConfigured,
        toasts,
        showToast,
        dismissToast,
        addTask,
        updateTask,
        deleteTask,
        addTicket,
        updateTicket,
        deleteTicket,
        addTicketWorkLog,
        ticketWorkLogs,
        activeTimers,
        startTimer,
        pauseTimer,
        stopTimer,
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
        shiftAssignments,
        assignShift,

        // OEM Cases & Registries
        oemCases,
        loadingOemCases,
        addOemCase: async (input) => {
          const newId = `OEM-${Date.now().toString().slice(-4)}`;
          const newCase: OemCase = { ...input, id: newId };

          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("oem_cases").insert({
                id: newId,
                product_name: input.productName,
                product_category: input.productCategory,
                client_id: input.clientId,
                client_name: input.clientName,
                case_type: input.caseType,
                oem_case_id: input.oemCaseId,
                internal_ticket_id: input.internalTicketId,
                title: input.title,
                description: input.description,
                priority: input.priority,
                assigned_to: input.assignedTo,
                raised_by: input.raisedBy,
                created_date: input.createdDate,
                updated_date: input.updatedDate,
                status_update: input.statusUpdate,
                closure_date: input.closureDate,
                notes: input.notes,
              });
              if (error) throw error;
            } catch (e: any) {
              console.error("Supabase OEM insert error:", e?.message, "| code:", e?.code, "| hint:", e?.hint, "| details:", e?.details);
              showToast("Couldn't save OEM case to the server — saved locally only.");
            }
          }

          const updated = [...oemCases, newCase];
          setOemCases(updated);
        },
        updateOemCase: async (updatedCase) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase
                .from("oem_cases")
                .update({
                  product_name: updatedCase.productName,
                  product_category: updatedCase.productCategory,
                  client_id: updatedCase.clientId,
                  client_name: updatedCase.clientName,
                  case_type: updatedCase.caseType,
                  oem_case_id: updatedCase.oemCaseId,
                  internal_ticket_id: updatedCase.internalTicketId,
                  title: updatedCase.title,
                  description: updatedCase.description,
                  priority: updatedCase.priority,
                  assigned_to: updatedCase.assignedTo,
                  raised_by: updatedCase.raisedBy,
                  created_date: updatedCase.createdDate,
                  updated_date: updatedCase.updatedDate,
                  status_update: updatedCase.statusUpdate,
                  closure_date: updatedCase.closureDate,
                  notes: updatedCase.notes,
                })
                .eq("id", updatedCase.id);
              if (error) throw error;
            } catch (e: any) {
              console.error("Supabase OEM update error:", e?.message, "| code:", e?.code, "| hint:", e?.hint, "| details:", e?.details);
              showToast("Couldn't save OEM case changes to the server — saved locally only.");
            }
          }

          const updated = oemCases.map((c) => (c.id === updatedCase.id ? updatedCase : c));
          setOemCases(updated);
        },
        deleteOemCase: async (id) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("oem_cases").delete().eq("id", id);
              if (error) throw error;
            } catch (e: any) {
              console.error("Supabase OEM delete error:", e?.message, "| code:", e?.code, "| hint:", e?.hint, "| details:", e?.details);
              showToast("Couldn't delete OEM case on the server — removed locally only.");
            }
          }

          const updated = oemCases.filter((c) => c.id !== id);
          setOemCases(updated);
        },

        productCategories,
        addProductCategory: (cat) => {
          const trimmed = cat.trim();
          if (!trimmed || productCategories.includes(trimmed)) return;
          const updated = [...productCategories, trimmed];
          setProductCategories(updated);
        },
        removeProductCategory: (cat) => {
          const updated = productCategories.filter((c) => c !== cat);
          setProductCategories(updated);
        },

        caseTypes,
        addCaseType: (type) => {
          const trimmed = type.trim();
          if (!trimmed || caseTypes.includes(trimmed)) return;
          const updated = [...caseTypes, trimmed];
          setCaseTypes(updated);
        },
        removeCaseType: (type) => {
          const updated = caseTypes.filter((t) => t !== type);
          setCaseTypes(updated);
        },

        statusUpdates,
        addStatusUpdate: (status) => {
          const trimmed = status.trim();
          if (!trimmed || statusUpdates.includes(trimmed)) return;
          const updated = [...statusUpdates, trimmed];
          setStatusUpdates(updated);
        },
        removeStatusUpdate: (status) => {
          const updated = statusUpdates.filter((s) => s !== status);
          setStatusUpdates(updated);
        },

        // Shift Roster
        rosterMembers,
        rosterAssignments,
        shiftPresets,
        assignRosterShift: async (employeeId, date, shiftCode) => {
          const key = `${employeeId}_${date}`;
          if (isSupabaseConfigured && supabase) {
            try {
              const { data: existing } = await supabase
                .from("roster_assignments")
                .select("id")
                .eq("employee_id", employeeId)
                .eq("date_str", date)
                .maybeSingle();

              if (existing) {
                const { error } = await supabase
                  .from("roster_assignments")
                  .update({ shift_code: shiftCode })
                  .eq("id", existing.id);
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from("roster_assignments")
                  .insert({
                    employee_id: employeeId,
                    date_str: date,
                    shift_code: shiftCode,
                  });
                if (error) throw error;
              }
            } catch (err) {
              console.error("Supabase roster assignment write error:", err);
              showToast("Couldn't save shift assignment to the server. Please retry.");
              return;
            }
          }
          setRosterAssignments((prev) => {
            const updated = { ...prev, [key]: shiftCode };
            return updated;
          });
        },
        bulkAssignRosterShifts: async (employeeId, startDate, endDate, shiftCode) => {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const curr = new Date(start);
          const batch: any[] = [];
          const localUpdates: Record<string, string> = {};

          while (curr <= end) {
            const yyyy = curr.getFullYear();
            const mm = String(curr.getMonth() + 1).padStart(2, "0");
            const dd = String(curr.getDate()).padStart(2, "0");
            const dateStr = `${yyyy}-${mm}-${dd}`;
            batch.push({
              employee_id: employeeId,
              date_str: dateStr,
              shift_code: shiftCode,
            });
            localUpdates[`${employeeId}_${dateStr}`] = shiftCode;
            curr.setDate(curr.getDate() + 1);
          }

          if (isSupabaseConfigured && supabase) {
            try {
              const { data: existing } = await supabase
                .from("roster_assignments")
                .select("id, date_str")
                .eq("employee_id", employeeId)
                .gte("date_str", startDate)
                .lte("date_str", endDate);

              const existingMap = new Map(existing?.map((x) => [x.date_str, x.id]) || []);
              const toInsert: any[] = [];
              const toUpdate: any[] = [];

              batch.forEach((item) => {
                const existingId = existingMap.get(item.date_str);
                if (existingId) {
                  toUpdate.push({
                    id: existingId,
                    shift_code: shiftCode,
                  });
                } else {
                  toInsert.push(item);
                }
              });

              if (toInsert.length > 0) {
                const { error } = await supabase.from("roster_assignments").insert(toInsert);
                if (error) throw error;
              }
              for (const item of toUpdate) {
                const { error } = await supabase
                  .from("roster_assignments")
                  .update({ shift_code: item.shift_code })
                  .eq("id", item.id);
                if (error) throw error;
              }
            } catch (err) {
              console.error("Supabase bulk roster assignment write error:", err);
              showToast("Couldn't save bulk shift assignments to the server. Please retry.");
              return;
            }
          }

          setRosterAssignments((prev) => {
            const updated = { ...prev, ...localUpdates };
            return updated;
          });
        },
        // Batch-save all pending roster changes at once (called by the "Publish Roster" button)
        saveRosterChanges: async (changes) => {
          if (Object.keys(changes).length === 0) return;

          // Apply to local state immediately
          setRosterAssignments((prev) => {
            const updated = { ...prev, ...changes };
            return updated;
          });

          // Persist to Supabase if configured
          if (isSupabaseConfigured && supabase) {
            try {
              // Group changes by employeeId for efficient queries
              const byEmployee: Record<string, { dateStr: string; shiftCode: string }[]> = {};
              for (const [key, shiftCode] of Object.entries(changes)) {
                const [employeeId, ...dateParts] = key.split("_");
                const dateStr = dateParts.join("_");
                if (!byEmployee[employeeId]) byEmployee[employeeId] = [];
                byEmployee[employeeId].push({ dateStr, shiftCode });
              }

              for (const [empId, assignments] of Object.entries(byEmployee)) {
                const datestrs = assignments.map((a) => a.dateStr);
                const minDate = datestrs.reduce((a, b) => (a < b ? a : b));
                const maxDate = datestrs.reduce((a, b) => (a > b ? a : b));

                // Fetch existing rows for this employee in the date range
                const { data: existing } = await supabase
                  .from("roster_assignments")
                  .select("id, date_str")
                  .eq("employee_id", empId)
                  .gte("date_str", minDate)
                  .lte("date_str", maxDate);

                const existingMap = new Map(existing?.map((x: any) => [x.date_str, x.id]) || []);
                const toInsert: any[] = [];
                const toUpdate: { id: string; shift_code: string }[] = [];

                for (const { dateStr, shiftCode } of assignments) {
                  const existingId = existingMap.get(dateStr);
                  if (existingId) {
                    toUpdate.push({ id: existingId, shift_code: shiftCode });
                  } else {
                    toInsert.push({ employee_id: empId, date_str: dateStr, shift_code: shiftCode });
                  }
                }

                if (toInsert.length > 0) {
                  const { error } = await supabase.from("roster_assignments").insert(toInsert);
                  if (error) throw error;
                }
                for (const item of toUpdate) {
                  const { error } = await supabase
                    .from("roster_assignments")
                    .update({ shift_code: item.shift_code })
                    .eq("id", item.id);
                  if (error) throw error;
                }
              }
            } catch (err) {
              console.error("Supabase batch roster save error:", err);
              showToast("Roster changes may not have fully saved to the server — please verify and republish.");
            }
          }
        },
        clearRosterMonth: async (year, month) => {
          const monthStr = String(month + 1).padStart(2, "0");
          const prefix = `${year}-${monthStr}-`;
          
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase
                .from("roster_assignments")
                .delete()
                .like("date_str", `${prefix}%`);
              if (error) throw error;
            } catch (err) {
              console.error("Error clearing roster month:", err);
              showToast("Couldn't clear the month on the server. Please retry.");
              return;
            }
          }

          setRosterAssignments((prev) => {
            const updated = { ...prev };
            for (const key of Object.keys(updated)) {
              // key is employeeId_YYYY-MM-DD
              const datePart = key.split("_")[1];
              if (datePart && datePart.startsWith(prefix)) {
                delete updated[key];
              }
            }
            return updated;
          });
        },

        shiftRequests,
        submitShiftRequest: async (dateStr, requestedShiftCode, reason) => {
          if (isSupabaseConfigured && supabase && user) {
            try {
              const { data, error } = await supabase
                .from("shift_requests")
                .insert({
                  user_id: user.id,
                  employee_id: employeeId || "unknown",
                  employee_name: username || "User",
                  date_str: dateStr,
                  requested_shift_code: requestedShiftCode,
                  reason: reason,
                  status: "pending",
                })
                .select()
                .single();

              if (error) throw error;
              if (data) {
                const req: ShiftRequest = {
                  id: Number(data.id),
                  userId: data.user_id,
                  employeeId: data.employee_id,
                  employeeName: data.employee_name,
                  dateStr: data.date_str,
                  requestedShiftCode: data.requested_shift_code,
                  reason: data.reason || "",
                  status: data.status as any,
                  createdAt: data.created_at,
                };
                setShiftRequests((prev) => [req, ...prev]);
                return true;
              }
            } catch (err) {
              console.error("Error submitting shift request:", err);
              showToast("Couldn't submit shift change request to the server. Please retry.");
              return false;
            }
          }
          return false;
        },
        reviewShiftRequest: async (requestId, status) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { data, error } = await supabase
                .from("shift_requests")
                .update({ status: status })
                .eq("id", requestId)
                .select()
                .single();

              if (error) throw error;

              if (data) {
                if (status === "approved") {
                  const { data: existingRoster } = await supabase
                    .from("roster_assignments")
                    .select("id")
                    .eq("employee_id", data.employee_id)
                    .eq("date_str", data.date_str)
                    .maybeSingle();

                  if (existingRoster) {
                    const { error: rosterErr } = await supabase
                      .from("roster_assignments")
                      .update({ shift_code: data.requested_shift_code })
                      .eq("id", existingRoster.id);
                    if (rosterErr) throw rosterErr;
                  } else {
                    const { error: rosterErr } = await supabase
                      .from("roster_assignments")
                      .insert({
                        employee_id: data.employee_id,
                        date_str: data.date_str,
                        shift_code: data.requested_shift_code,
                      });
                    if (rosterErr) throw rosterErr;
                  }

                  const key = `${data.employee_id}_${data.date_str}`;
                  setRosterAssignments((prev) => ({
                    ...prev,
                    [key]: data.requested_shift_code,
                  }));
                }

                setShiftRequests((prev) =>
                  prev.map((r) =>
                    r.id === requestId ? { ...r, status: status } : r
                  )
                );
              }
            } catch (err) {
              console.error("Error reviewing shift request:", err);
              showToast("Couldn't process the shift request on the server. Please retry.");
            }
          }
        },
        addShiftPreset: (preset) => {
          if (!preset.code) return;
          setShiftPresets((prev) => {
            const updated = prev.some((p) => p.code === preset.code)
              ? prev.map((p) => (p.code === preset.code ? preset : p))
              : [...prev, preset];
            return updated;
          });
        },
        removeShiftPreset: (code) => {
          setShiftPresets((prev) => {
            const updated = prev.filter((p) => p.code !== code);
            return updated;
          });
        },
        // Password Vault State & Handlers
        vaultProducts,
        personalVault,
        masterPassword,
        updateMasterPassword: async (newPin) => {
          if (!requireAdminForVault("change the team vault master password")) return;
          const trimmed = newPin.trim();
          if (!trimmed) return;

          if (isSupabaseConfigured && supabase) {
            try {
              const { data: wrapRow, error: wrapFetchErr } = await supabase
                .from("vault_key_wraps")
                .select("wrapped_dek_passphrase")
                .eq("id", "team")
                .maybeSingle();
              if (wrapFetchErr) throw wrapFetchErr;

              if (wrapRow?.wrapped_dek_passphrase) {
                // Recovery Kit is active: entries are encrypted under a DEK
                // that never changes here — just re-wrap that same DEK under
                // the new passphrase. Cheap, and doesn't touch a single entry.
                const oldPassphraseKey = await deriveVaultKey(masterPassword, "team");
                const dek = await unwrapDataEncryptionKey(oldPassphraseKey, wrapRow.wrapped_dek_passphrase as EncryptedEnvelope);
                const newPassphraseKey = await deriveVaultKey(trimmed, "team");
                const rewrappedDek = await wrapDataEncryptionKey(newPassphraseKey, dek);
                const { error: updateErr } = await supabase
                  .from("vault_key_wraps")
                  .update({ wrapped_dek_passphrase: rewrappedDek, updated_at: new Date().toISOString() })
                  .eq("id", "team");
                if (updateErr) throw updateErr;

                teamKeyCacheRef.current = { passphrase: trimmed, key: dek };
                showToast("Team vault master password updated.", "success");
              } else {
                // No Recovery Kit yet — fall back to the original scheme:
                // re-encrypt every existing entry under the new passphrase
                // directly, otherwise every credential set becomes
                // permanently undecryptable the moment the passphrase changes.
                const newKey = await deriveVaultKey(trimmed, "team");
                const allEntries = vaultProducts.flatMap((p) =>
                  p.clients.flatMap((c) => c.entries.map((entry) => ({ productId: p.id, clientId: c.id, entry })))
                );

                for (const { entry } of allEntries) {
                  const envelope = await encryptVaultPayload(newKey, {
                    fields: entry.fields,
                    notes: entry.notes || "",
                  });
                  const { error } = await supabase
                    .from("vault_entries")
                    .update({ fields: envelope })
                    .eq("id", entry.id);
                  if (error) throw error;
                }

                teamKeyCacheRef.current = { passphrase: trimmed, key: newKey };
                showToast(`Team vault master password updated — re-encrypted ${allEntries.length} credential set(s). Consider setting up a Recovery Kit so future password changes don't need to re-encrypt everything.`, "success");
              }
            } catch (e) {
              const msg = describeSupabaseError("Error rotating team vault master password", e);
              showToast(`Couldn't re-encrypt the team vault under the new password (${msg}). No changes were made — please retry.`);
              return;
            }
          }

          setMasterPasswordState(trimmed);
          if (typeof window !== "undefined") {
            localStorage.setItem("nestor_master_password", trimmed);
          }
        },
        personalVaultPin,
        updatePersonalVaultPin: async (newPin) => {
          if (!requirePersonalVaultReady()) return;
          const trimmed = newPin.trim();
          if (!trimmed) return;

          if (isSupabaseConfigured && supabase && user) {
            try {
              const { data: wrapRow, error: wrapFetchErr } = await supabase
                .from("vault_key_wraps")
                .select("wrapped_dek_passphrase")
                .eq("id", user.id)
                .maybeSingle();
              if (wrapFetchErr) throw wrapFetchErr;

              if (wrapRow?.wrapped_dek_passphrase) {
                // Recovery Kit active: just re-wrap the same DEK — no entry
                // needs to be touched.
                const oldPassphraseKey = await deriveVaultKey(personalVaultPin, `personal:${employeeId || "local"}`);
                const dek = await unwrapDataEncryptionKey(oldPassphraseKey, wrapRow.wrapped_dek_passphrase as EncryptedEnvelope);
                const newPassphraseKey = await deriveVaultKey(trimmed, `personal:${employeeId || "local"}`);
                const rewrappedDek = await wrapDataEncryptionKey(newPassphraseKey, dek);
                const { error: updateErr } = await supabase
                  .from("vault_key_wraps")
                  .update({ wrapped_dek_passphrase: rewrappedDek, updated_at: new Date().toISOString() })
                  .eq("id", user.id);
                if (updateErr) throw updateErr;

                personalKeyCacheRef.current = { passphrase: `${employeeId || "local"}:${trimmed}`, key: dek };
                showToast("Personal vault PIN updated.", "success");
              } else {
                const newKey = await deriveVaultKey(trimmed, `personal:${employeeId || "local"}`);
                for (const entry of personalVault) {
                  const envelope = await encryptVaultPayload(newKey, {
                    fields: entry.fields,
                    notes: entry.notes || "",
                  });
                  const { error } = await supabase
                    .from("personal_vault")
                    .update({ fields: envelope })
                    .eq("id", entry.id);
                  if (error) throw error;
                }
                personalKeyCacheRef.current = { passphrase: `${employeeId || "local"}:${trimmed}`, key: newKey };
                showToast(`Personal vault PIN updated — re-encrypted ${personalVault.length} entr${personalVault.length === 1 ? "y" : "ies"}. Consider setting up a Recovery Kit so future PIN changes don't need to re-encrypt everything.`, "success");
              }
            } catch (e) {
              const msg = describeSupabaseError("Error rotating personal vault PIN", e);
              showToast(`Couldn't re-encrypt your personal vault under the new PIN (${msg}). No changes were made — please retry.`);
              return;
            }
          }

          setPersonalVaultPinState(trimmed);
          if (typeof window !== "undefined") {
            localStorage.setItem(`nestor_personal_vault_pin_${employeeId || "local"}`, trimmed);
          }
        },

        teamVaultRecoveryKitActive,
        personalVaultRecoveryKitActive,

        setupTeamVaultRecoveryKit: async () => {
          if (!requireAdminForVault("set up the team vault recovery kit")) return null;
          if (!isSupabaseConfigured || !supabase) {
            showToast("Recovery Kit requires Supabase to be configured.");
            return null;
          }
          try {
            const { data: existing, error: existingErr } = await supabase
              .from("vault_key_wraps")
              .select("id")
              .eq("id", "team")
              .maybeSingle();
            if (existingErr) throw existingErr;
            if (existing) {
              showToast("A Recovery Kit already exists for the Team Vault. Reset it if you need a fresh code.");
              return null;
            }

            const passphraseKey = await getTeamVaultKey();
            const dek = await generateDataEncryptionKey();
            const allEntries = vaultProducts.flatMap((p) => p.clients.flatMap((c) => c.entries));

            const recoveryCode = generateRecoveryCode();
            const recoveryKey = await deriveVaultKey(recoveryCode, "team-recovery");
            const wrappedByPassphrase = await wrapDataEncryptionKey(passphraseKey, dek);
            const wrappedByRecovery = await wrapDataEncryptionKey(recoveryKey, dek);

            // Commit the wrap row BEFORE touching any entry. If the entries
            // loop below is interrupted partway (network drop, etc.), the DEK
            // is still fully recoverable via the wrap row, and loadVault's
            // decrypt fallback (try the direct passphrase key if the resolved
            // DEK fails) transparently covers any entry that didn't finish
            // migrating — so an interruption here can never stall the whole
            // vault the way writing the wrap row last would.
            const { error: insertErr } = await supabase.from("vault_key_wraps").insert({
              id: "team",
              scope: "team",
              wrapped_dek_passphrase: wrappedByPassphrase,
              wrapped_dek_recovery: wrappedByRecovery,
            });
            if (insertErr) throw insertErr;

            teamKeyCacheRef.current = { passphrase: masterPassword, key: dek };
            setTeamVaultRecoveryKitActive(true);

            for (const entry of allEntries) {
              const envelope = await encryptVaultPayload(dek, { fields: entry.fields, notes: entry.notes || "" });
              const { error } = await supabase.from("vault_entries").update({ fields: envelope }).eq("id", entry.id);
              if (error) throw error;
            }

            showToast(`Team Vault Recovery Kit created — re-encrypted ${allEntries.length} credential set(s).`, "success");
            return recoveryCode;
          } catch (e) {
            const msg = describeSupabaseError("Error setting up team vault recovery kit", e);
            showToast(`Couldn't set up the recovery kit (${msg}).`);
            return null;
          }
        },

        setupPersonalVaultRecoveryKit: async () => {
          if (!isSupabaseConfigured || !supabase || !user) {
            showToast("Recovery Kit requires Supabase to be configured.");
            return null;
          }
          if (!requirePersonalVaultReady()) return null;
          try {
            const { data: existing, error: existingErr } = await supabase
              .from("vault_key_wraps")
              .select("id")
              .eq("id", user.id)
              .maybeSingle();
            if (existingErr) throw existingErr;
            if (existing) {
              showToast("A Recovery Kit already exists for your Personal Vault. Reset it if you need a fresh code.");
              return null;
            }

            const passphraseKey = await getPersonalVaultKey();
            const dek = await generateDataEncryptionKey();

            const recoveryCode = generateRecoveryCode();
            const recoveryKey = await deriveVaultKey(recoveryCode, `personal-recovery:${employeeId || "local"}`);
            const wrappedByPassphrase = await wrapDataEncryptionKey(passphraseKey, dek);
            const wrappedByRecovery = await wrapDataEncryptionKey(recoveryKey, dek);

            // Commit the wrap row before touching any entry — see the matching
            // comment in setupTeamVaultRecoveryKit for why this ordering
            // matters (makes an interrupted migration safe/recoverable).
            const { error: insertErr } = await supabase.from("vault_key_wraps").insert({
              id: user.id,
              scope: "personal",
              wrapped_dek_passphrase: wrappedByPassphrase,
              wrapped_dek_recovery: wrappedByRecovery,
            });
            if (insertErr) throw insertErr;

            personalKeyCacheRef.current = { passphrase: `${employeeId || "local"}:${personalVaultPin}`, key: dek };
            setPersonalVaultRecoveryKitActive(true);

            for (const entry of personalVault) {
              const envelope = await encryptVaultPayload(dek, { fields: entry.fields, notes: entry.notes || "" });
              const { error } = await supabase.from("personal_vault").update({ fields: envelope }).eq("id", entry.id);
              if (error) throw error;
            }

            showToast(`Personal Vault Recovery Kit created — re-encrypted ${personalVault.length} entr${personalVault.length === 1 ? "y" : "ies"}.`, "success");
            return recoveryCode;
          } catch (e) {
            const msg = describeSupabaseError("Error setting up personal vault recovery kit", e);
            showToast(`Couldn't set up the recovery kit (${msg}).`);
            return null;
          }
        },

        recoverTeamVaultWithCode: async (code, newPassword) => {
          if (!requireAdminForVault("recover the team vault")) return false;
          const trimmedCode = normalizeRecoveryCode(code);
          const trimmedNewPass = newPassword.trim();
          if (!trimmedCode || !trimmedNewPass) return false;
          if (!isSupabaseConfigured || !supabase) return false;
          try {
            const { data: wrapRow, error: fetchErr } = await supabase
              .from("vault_key_wraps")
              .select("wrapped_dek_recovery")
              .eq("id", "team")
              .maybeSingle();
            if (fetchErr) throw fetchErr;
            if (!wrapRow?.wrapped_dek_recovery) {
              showToast("No Recovery Kit has been set up for the Team Vault — recovery by code isn't available.");
              return false;
            }

            const recoveryKey = await deriveVaultKey(trimmedCode, "team-recovery");
            const dek = await unwrapDataEncryptionKey(recoveryKey, wrapRow.wrapped_dek_recovery as EncryptedEnvelope);
            const newPassphraseKey = await deriveVaultKey(trimmedNewPass, "team");
            const rewrappedDek = await wrapDataEncryptionKey(newPassphraseKey, dek);

            const { error: updateErr } = await supabase
              .from("vault_key_wraps")
              .update({ wrapped_dek_passphrase: rewrappedDek, updated_at: new Date().toISOString() })
              .eq("id", "team");
            if (updateErr) throw updateErr;

            teamKeyCacheRef.current = { passphrase: trimmedNewPass, key: dek };
            setMasterPasswordState(trimmedNewPass);
            if (typeof window !== "undefined") {
              localStorage.setItem("nestor_master_password", trimmedNewPass);
            }
            showToast("Team vault master password reset using your recovery code — no data was lost.", "success");
            return true;
          } catch (e) {
            describeSupabaseError("Error recovering team vault with code", e);
            showToast("Recovery failed — check that the recovery code was entered correctly.");
            return false;
          }
        },

        recoverPersonalVaultWithCode: async (code, newPin) => {
          const trimmedCode = normalizeRecoveryCode(code);
          const trimmedNewPin = newPin.trim();
          if (!trimmedCode || !trimmedNewPin) return false;
          if (!isSupabaseConfigured || !supabase || !user) return false;
          try {
            const { data: wrapRow, error: fetchErr } = await supabase
              .from("vault_key_wraps")
              .select("wrapped_dek_recovery")
              .eq("id", user.id)
              .maybeSingle();
            if (fetchErr) throw fetchErr;
            if (!wrapRow?.wrapped_dek_recovery) {
              showToast("No Recovery Kit has been set up for your Personal Vault — recovery by code isn't available.");
              return false;
            }

            const recoveryKey = await deriveVaultKey(trimmedCode, `personal-recovery:${employeeId || "local"}`);
            const dek = await unwrapDataEncryptionKey(recoveryKey, wrapRow.wrapped_dek_recovery as EncryptedEnvelope);
            const newPassphraseKey = await deriveVaultKey(trimmedNewPin, `personal:${employeeId || "local"}`);
            const rewrappedDek = await wrapDataEncryptionKey(newPassphraseKey, dek);

            const { error: updateErr } = await supabase
              .from("vault_key_wraps")
              .update({ wrapped_dek_passphrase: rewrappedDek, updated_at: new Date().toISOString() })
              .eq("id", user.id);
            if (updateErr) throw updateErr;

            personalKeyCacheRef.current = { passphrase: `${employeeId || "local"}:${trimmedNewPin}`, key: dek };
            setPersonalVaultPinState(trimmedNewPin);
            if (typeof window !== "undefined") {
              localStorage.setItem(`nestor_personal_vault_pin_${employeeId || "local"}`, trimmedNewPin);
            }
            showToast("Personal vault PIN reset using your recovery code — no data was lost.", "success");
            return true;
          } catch (e) {
            describeSupabaseError("Error recovering personal vault with code", e);
            showToast("Recovery failed — check that the recovery code was entered correctly.");
            return false;
          }
        },

        resetTeamVault: async (newPassword) => {
          if (!requireAdminForVault("reset the team vault")) return null;
          const trimmed = newPassword.trim();
          if (!trimmed) return null;
          if (!isSupabaseConfigured || !supabase) return null;
          try {
            const allEntryIds = vaultProducts.flatMap((p) => p.clients.flatMap((c) => c.entries.map((e) => e.id)));
            if (allEntryIds.length > 0) {
              const { error: delErr } = await supabase.from("vault_entries").delete().in("id", allEntryIds);
              if (delErr) throw delErr;
            }
            const { error: delWrapErr } = await supabase.from("vault_key_wraps").delete().eq("id", "team");
            if (delWrapErr) throw delWrapErr;

            const dek = await generateDataEncryptionKey();
            const recoveryCode = generateRecoveryCode();
            const recoveryKey = await deriveVaultKey(recoveryCode, "team-recovery");
            const newPassphraseKey = await deriveVaultKey(trimmed, "team");
            const wrappedByPassphrase = await wrapDataEncryptionKey(newPassphraseKey, dek);
            const wrappedByRecovery = await wrapDataEncryptionKey(recoveryKey, dek);

            const { error: insertErr } = await supabase.from("vault_key_wraps").insert({
              id: "team",
              scope: "team",
              wrapped_dek_passphrase: wrappedByPassphrase,
              wrapped_dek_recovery: wrappedByRecovery,
            });
            if (insertErr) throw insertErr;

            teamKeyCacheRef.current = { passphrase: trimmed, key: dek };
            setTeamVaultRecoveryKitActive(true);
            setMasterPasswordState(trimmed);
            if (typeof window !== "undefined") {
              localStorage.setItem("nestor_master_password", trimmed);
            }
            setVaultProducts((prev) => prev.map((p) => ({ ...p, clients: p.clients.map((c) => ({ ...c, entries: [] })) })));
            showToast("Team Vault has been reset. All previous credential sets were deleted (they were unrecoverable) and a new Recovery Kit was created.", "success");
            return recoveryCode;
          } catch (e) {
            const msg = describeSupabaseError("Error resetting team vault", e);
            showToast(`Couldn't reset the team vault (${msg}).`);
            return null;
          }
        },

        resetPersonalVault: async (newPin) => {
          const trimmed = newPin.trim();
          if (!trimmed) return null;
          if (!isSupabaseConfigured || !supabase || !user) return null;
          try {
            const allEntryIds = personalVault.map((e) => e.id);
            if (allEntryIds.length > 0) {
              const { error: delErr } = await supabase.from("personal_vault").delete().in("id", allEntryIds);
              if (delErr) throw delErr;
            }
            const { error: delWrapErr } = await supabase.from("vault_key_wraps").delete().eq("id", user.id);
            if (delWrapErr) throw delWrapErr;

            const dek = await generateDataEncryptionKey();
            const recoveryCode = generateRecoveryCode();
            const recoveryKey = await deriveVaultKey(recoveryCode, `personal-recovery:${employeeId || "local"}`);
            const newPassphraseKey = await deriveVaultKey(trimmed, `personal:${employeeId || "local"}`);
            const wrappedByPassphrase = await wrapDataEncryptionKey(newPassphraseKey, dek);
            const wrappedByRecovery = await wrapDataEncryptionKey(recoveryKey, dek);

            const { error: insertErr } = await supabase.from("vault_key_wraps").insert({
              id: user.id,
              scope: "personal",
              wrapped_dek_passphrase: wrappedByPassphrase,
              wrapped_dek_recovery: wrappedByRecovery,
            });
            if (insertErr) throw insertErr;

            personalKeyCacheRef.current = { passphrase: `${employeeId || "local"}:${trimmed}`, key: dek };
            setPersonalVaultRecoveryKitActive(true);
            setPersonalVaultPinState(trimmed);
            if (typeof window !== "undefined") {
              localStorage.setItem(`nestor_personal_vault_pin_${employeeId || "local"}`, trimmed);
            }
            setPersonalVault([]);
            showToast("Your Personal Vault has been reset. All previous entries were deleted (they were unrecoverable) and a new Recovery Kit was created.", "success");
            return recoveryCode;
          } catch (e) {
            const msg = describeSupabaseError("Error resetting personal vault", e);
            showToast(`Couldn't reset your personal vault (${msg}).`);
            return null;
          }
        },

        vaultChangeRequests,
        submitVaultChangeRequest: async (entryId, fieldId, newValue, reason, secureUrl) => {
          const trimmedValue = newValue.trim();
          const trimmedReason = reason.trim();
          const trimmedUrl = secureUrl?.trim() || undefined;
          if (!trimmedValue && !trimmedUrl) return false;
          if (!isSupabaseConfigured || !supabase || !user) {
            showToast("This requires Supabase to be configured.");
            return false;
          }
          try {
            // Encrypted under the Team Vault key — the member submitting this
            // already has it unlocked (that's how they saw the field to
            // request a change to it), so this never touches the network or
            // the database in plain text.
            const teamKey = await getTeamVaultKey();
            const envelope = await encryptVaultPayload(teamKey, { value: trimmedValue, url: trimmedUrl });
            const { data, error } = await supabase
              .from("vault_change_requests")
              .insert({
                user_id: user.id,
                requester_name: username || "User",
                entry_id: entryId,
                field_id: fieldId,
                new_value: JSON.stringify(envelope),
                reason: trimmedReason,
                status: "pending",
              })
              .select()
              .single();
            if (error) throw error;
            if (data) {
              const req: VaultChangeRequest = {
                id: Number(data.id),
                userId: data.user_id,
                requesterName: data.requester_name,
                entryId: data.entry_id,
                fieldId: data.field_id,
                newValue: trimmedValue,
                secureUrl: trimmedUrl,
                reason: data.reason || "",
                status: data.status,
                createdAt: data.created_at,
                reviewedBy: data.reviewed_by,
                reviewedAt: data.reviewed_at,
              };
              setVaultChangeRequests((prev) => [req, ...prev]);
              showToast("Change request submitted — an admin will review it.", "success");
              return true;
            }
            return false;
          } catch (e) {
            const msg = describeSupabaseError("Error submitting vault change request", e);
            showToast(`Couldn't submit the change request (${msg}).`);
            return false;
          }
        },
        reviewVaultChangeRequest: async (requestId, decision) => {
          if (!requireAdminForVault("review vault change requests")) return;
          if (!isSupabaseConfigured || !supabase) return;
          try {
            const { data: reqRow, error: fetchErr } = await supabase
              .from("vault_change_requests")
              .select("*")
              .eq("id", requestId)
              .maybeSingle();
            if (fetchErr) throw fetchErr;
            if (!reqRow) {
              showToast("This request no longer exists.");
              return;
            }

            if (decision === "approved") {
              let targetEntry: VaultEntry | null = null;
              let targetProductId = "";
              let targetClientId = "";
              for (const p of vaultProducts) {
                for (const c of p.clients) {
                  const found = c.entries.find((e) => e.id === reqRow.entry_id);
                  if (found) {
                    targetEntry = found;
                    targetProductId = p.id;
                    targetClientId = c.id;
                    break;
                  }
                }
                if (targetEntry) break;
              }
              if (!targetEntry) {
                showToast("The credential set this request targets no longer exists — rejecting is the only option now.");
                return;
              }

              const teamKey = await getTeamVaultKey();
              const { value: decryptedNewValue, url: decryptedUrl, locked } = await decryptVaultChangeRequestValue(reqRow.new_value);
              if (locked) {
                showToast("Couldn't decrypt this request's value — make sure the Team Vault is unlocked with the current Master Password.");
                return;
              }
              // A request may carry just a secure link instead of a typed value
              // (e.g. a password-manager share link) — fall back to that.
              const valueToApply = decryptedNewValue || decryptedUrl || "";

              const updatedFields = targetEntry.fields.map((f) =>
                f.id === reqRow.field_id ? { ...f, value: valueToApply } : f
              );

              const envelope = await encryptVaultPayload(teamKey, {
                fields: updatedFields,
                notes: targetEntry.notes || "",
              });
              const nowIso = new Date().toISOString();
              const { error: updErr } = await supabase
                .from("vault_entries")
                .update({ fields: envelope, updated_at: nowIso })
                .eq("id", targetEntry.id);
              if (updErr) throw updErr;

              setVaultProducts((prev) =>
                prev.map((p) =>
                  p.id !== targetProductId
                    ? p
                    : {
                        ...p,
                        clients: p.clients.map((c) =>
                          c.id !== targetClientId
                            ? c
                            : {
                                ...c,
                                entries: c.entries.map((e) =>
                                  e.id === targetEntry!.id ? { ...e, fields: updatedFields, updatedAt: nowIso } : e
                                ),
                              }
                        ),
                      }
                )
              );
            }

            const { error: reviewErr } = await supabase
              .from("vault_change_requests")
              .update({ status: decision, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
              .eq("id", requestId);
            if (reviewErr) throw reviewErr;

            setVaultChangeRequests((prev) =>
              prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r))
            );
            showToast(
              decision === "approved" ? "Credential updated and request approved." : "Request rejected.",
              "success"
            );
          } catch (e) {
            const msg = describeSupabaseError("Error reviewing vault change request", e);
            showToast(`Couldn't process the request (${msg}).`);
          }
        },

        addVaultProductGroup: async (category, productName) => {
          if (!requireAdminForVault("add a product group")) return;
          const newId = `prod-${Date.now()}`;
          const newGroup: VaultProductGroup = {
            id: newId,
            category: category.trim(),
            productName: productName.trim(),
            clients: [],
          };
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_products").insert({
                id: newId,
                category: category.trim(),
                product_name: productName.trim(),
              });
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase insert product group error", e);
              showToast(`Couldn't save product group to the server (${msg}) — saved locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = [...prev, newGroup];
            return updated;
          });
        },
        removeVaultProductGroup: async (productId) => {
          if (!requireAdminForVault("remove a product group")) return;
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_products").delete().eq("id", productId);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase delete product group error", e);
              showToast(`Couldn't delete product group on the server (${msg}) — removed locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.filter((p) => p.id !== productId);
            return updated;
          });
        },
        addVaultClientSection: async (productId, clientId, clientName) => {
          if (!requireAdminForVault("add a client setup")) return;
          const newId = `cli-${Date.now()}`;
          const newClient = {
            id: newId,
            clientId: clientId.trim(),
            clientName: clientName.trim(),
            entries: [],
          };
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_clients").insert({
                id: newId,
                product_id: productId,
                client_id: clientId.trim(),
                client_name: clientName.trim(),
              });
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase insert vault client error", e);
              showToast(`Couldn't save client to the server (${msg}) — saved locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              return { ...p, clients: [...p.clients, newClient] };
            });
            return updated;
          });
        },
        removeVaultClientSection: async (productId, clientSectionId) => {
          if (!requireAdminForVault("remove a client setup")) return;
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_clients").delete().eq("id", clientSectionId);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase delete vault client error", e);
              showToast(`Couldn't delete client on the server (${msg}) — removed locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              return { ...p, clients: p.clients.filter((c) => c.id !== clientSectionId) };
            });
            return updated;
          });
        },
        addVaultEntry: async (productId, clientSectionId, entryData) => {
          if (!requireAdminForVault("add a credential set")) return;
          const newId = `ent-${Date.now()}`;
          const todayStr = new Date().toISOString().split("T")[0];
          const newEntry: VaultEntry = {
            ...entryData,
            id: newId,
            createdAt: todayStr,
            updatedAt: todayStr,
          };
          if (isSupabaseConfigured && supabase) {
            try {
              const teamKey = await getTeamVaultKey();
              const envelope = await encryptVaultPayload(teamKey, {
                fields: entryData.fields,
                notes: entryData.notes || "",
              });
              const { error } = await supabase.from("vault_entries").insert({
                id: newId,
                product_id: productId,
                client_id: clientSectionId,
                label: entryData.label,
                fields: envelope,
              });
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase insert vault entry error", e);
              showToast(`Couldn't save vault entry to the server (${msg}) — saved locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              const updatedClients = p.clients.map((c) => {
                if (c.id !== clientSectionId) return c;
                return { ...c, entries: [...c.entries, newEntry] };
              });
              return { ...p, clients: updatedClients };
            });
            return updated;
          });
        },
        updateVaultEntry: async (productId, clientSectionId, updatedEntry) => {
          if (!requireAdminForVault("edit a credential set")) return;
          const todayStr = new Date().toISOString().split("T")[0];
          if (isSupabaseConfigured && supabase) {
            try {
              const teamKey = await getTeamVaultKey();
              const envelope = await encryptVaultPayload(teamKey, {
                fields: updatedEntry.fields,
                notes: updatedEntry.notes || "",
              });
              const { error } = await supabase
                .from("vault_entries")
                .update({
                  label: updatedEntry.label,
                  fields: envelope,
                  updated_at: todayStr,
                })
                .eq("id", updatedEntry.id);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase update vault entry error", e);
              showToast(`Couldn't save vault entry changes to the server (${msg}) — saved locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              const updatedClients = p.clients.map((c) => {
                if (c.id !== clientSectionId) return c;
                const updatedEntries = c.entries.map((e) => (e.id === updatedEntry.id ? { ...updatedEntry, updatedAt: todayStr } : e));
                return { ...c, entries: updatedEntries };
              });
              return { ...p, clients: updatedClients };
            });
            return updated;
          });
        },
        removeVaultEntry: async (productId, clientSectionId, entryId) => {
          if (!requireAdminForVault("delete a credential set")) return;
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_entries").delete().eq("id", entryId);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase delete vault entry error", e);
              showToast(`Couldn't delete vault entry on the server (${msg}) — removed locally only.`);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              const updatedClients = p.clients.map((c) => {
                if (c.id !== clientSectionId) return c;
                return { ...c, entries: c.entries.filter((e) => e.id !== entryId) };
              });
              return { ...p, clients: updatedClients };
            });
            return updated;
          });
        },
        addPersonalVaultEntry: async (entryData) => {
          if (!requirePersonalVaultReady()) return;
          const newId = `pers-${Date.now()}`;
          const todayStr = new Date().toISOString().split("T")[0];
          const newEntry: PersonalVaultEntry = {
            ...entryData,
            id: newId,
            username: username || "Me",
            createdAt: todayStr,
            updatedAt: todayStr,
          };
          if (isSupabaseConfigured && supabase && user) {
            try {
              const personalKey = await getPersonalVaultKey();
              const envelope = await encryptVaultPayload(personalKey, {
                fields: entryData.fields,
                notes: entryData.notes || "",
              });
              const { error } = await supabase.from("personal_vault").insert({
                id: newId,
                user_id: user.id,
                label: entryData.label,
                fields: envelope,
                username: username || "Me",
              });
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase insert personal vault entry error", e);
              showToast(`Couldn't save vault entry to the server (${msg}) — saved locally only.`);
            }
          }
          setPersonalVault((prev) => {
            const updated = [...prev, newEntry];
            return updated;
          });
        },
        updatePersonalVaultEntry: async (updatedEntry) => {
          if (!requirePersonalVaultReady()) return;
          const todayStr = new Date().toISOString().split("T")[0];
          if (isSupabaseConfigured && supabase && user) {
            try {
              const personalKey = await getPersonalVaultKey();
              const envelope = await encryptVaultPayload(personalKey, {
                fields: updatedEntry.fields,
                notes: updatedEntry.notes || "",
              });
              const { error } = await supabase
                .from("personal_vault")
                .update({
                  label: updatedEntry.label,
                  fields: envelope,
                  updated_at: todayStr,
                })
                .eq("id", updatedEntry.id);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase update personal vault entry error", e);
              showToast(`Couldn't save vault entry changes to the server (${msg}) — saved locally only.`);
            }
          }
          setPersonalVault((prev) => {
            const updated = prev.map((e) => (e.id === updatedEntry.id ? { ...updatedEntry, updatedAt: todayStr } : e));
            return updated;
          });
        },
        removePersonalVaultEntry: async (id) => {
          if (isSupabaseConfigured && supabase && user) {
            try {
              const { error } = await supabase.from("personal_vault").delete().eq("id", id);
              if (error) throw error;
            } catch (e) {
              const msg = describeSupabaseError("Supabase delete personal vault entry error", e);
              showToast(`Couldn't delete vault entry on the server (${msg}) — removed locally only.`);
            }
          }
          setPersonalVault((prev) => {
            const updated = prev.filter((e) => e.id !== id);
            return updated;
          });
        },

        // Auth User Details
        user,
        role,
        status,
        setStatus,
        employeeId,

        fontFamily,
        setFontFamily,
        accentTheme,
        setAccentTheme,
      }}
    >
      {children}
    </NestorContext.Provider>
  );
}

export function useNestor() {
  const context = useContext(NestorContext);
  if (context === undefined) {
    throw new Error("useNestor must be used within a NestorProvider");
  }
  return context;
}
