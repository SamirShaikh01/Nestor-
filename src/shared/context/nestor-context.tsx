"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Task, TaskCategory, TaskStatus } from "@/src/features/task/types";
import type { Ticket, TicketPriority, TicketStatus, TicketWorkLog } from "@/src/features/ticket/types";
import type { ShiftType, ShiftAssignment } from "@/src/features/calendar/types";
import type { OemCase } from "@/src/features/oem-case/types";
import type { RosterMember, ShiftPreset } from "@/src/features/shift-roster/types";
import type { VaultProductGroup, PersonalVaultEntry, VaultEntry } from "@/src/features/password-vault/types";
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

interface NestorContextType {
  tasks: Task[];
  tickets: Ticket[];
  loadingTasks: boolean;
  loadingTickets: boolean;
  isSupabaseActive: boolean;
  
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

  teamMembers: string[];
  addTeamMember: (name: string) => void;
  removeTeamMember: (name: string) => void;

  // Centralized Shift Roster State & Actions
  rosterMembers: RosterMember[];
  rosterAssignments: Record<string, string>;
  shiftPresets: ShiftPreset[];
  assignRosterShift: (employeeId: string, date: string, shiftCode: string) => void;
  bulkAssignRosterShifts: (employeeId: string, startDate: string, endDate: string, shiftCode: string) => void;
  saveRosterChanges: (changes: Record<string, string>) => Promise<void>;
  addRosterMember: (member: RosterMember) => void;
  removeRosterMember: (employeeId: string) => void;
  addShiftPreset: (preset: ShiftPreset) => void;
  removeShiftPreset: (code: string) => void;

  // Password Vault State & Actions
  vaultProducts: VaultProductGroup[];
  personalVault: PersonalVaultEntry[];
  masterPassword: string;
  updateMasterPassword: (newPin: string) => void;
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
  submitShiftRequest: (dateStr: string, requestedShiftCode: string, reason: string) => Promise<void>;
  reviewShiftRequest: (requestId: number, status: "approved" | "declined") => Promise<void>;

  // Font configuration
  fontFamily: string;
  setFontFamily: (font: string) => void;
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
const DEFAULT_TEAM_MEMBERS = ["Samir", "Admin John", "SOC Lead Mary", "Security Lead Sam", "User"];

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

  const [teamMembers, setTeamMembers] = useState<string[]>(DEFAULT_TEAM_MEMBERS);

  // Centralized Shift Roster states
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>(initialRosterMembers);

  const [rosterAssignments, setRosterAssignments] = useState<Record<string, string>>(generateInitialAssignments());

  const [shiftPresets, setShiftPresets] = useState<ShiftPreset[]>(initialShiftPresets);

  // Password Vault States
  const [vaultProducts, setVaultProducts] = useState<VaultProductGroup[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nestor_vault_products");
      if (saved) {
        try { return JSON.parse(saved); } catch { return initialVaultProducts; }
      } else {
        localStorage.setItem("nestor_vault_products", JSON.stringify(initialVaultProducts));
        return initialVaultProducts;
      }
    }
    return initialVaultProducts;
  });

  const [personalVault, setPersonalVault] = useState<PersonalVaultEntry[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nestor_personal_vault");
      if (saved) {
        try { return JSON.parse(saved); } catch { return initialPersonalVault; }
      } else {
        localStorage.setItem("nestor_personal_vault", JSON.stringify(initialPersonalVault));
        return initialPersonalVault;
      }
    }
    return initialPersonalVault;
  });

  const [masterPassword, setMasterPasswordState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nestor_master_password");
      if (saved) return saved;
    }
    return "1234";
  });

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
            const mapped: VaultProductGroup[] = dbProds.map((p) => {
              const clientsForProd = (dbClients || [])
                .filter((c) => c.product_id === p.id)
                .map((c) => {
                  const entriesForClient = (dbEntries || [])
                    .filter((e) => e.product_id === p.id && e.client_id === c.id)
                    .map((e) => ({
                      id: e.id,
                      label: e.label || e.title || "",
                      addedBy: e.added_by || "Admin",
                      createdAt: e.created_at || new Date().toISOString(),
                      updatedAt: e.updated_at || new Date().toISOString(),
                      notes: e.notes || "",
                      fields: e.fields || [],
                    }));

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
          }
        } catch (e) {
          console.error("Error loading team vault from Supabase:", e);
        }

        // Load Personal Vault
        try {
          const { data: dbPers } = await supabase
            .from("personal_vault")
            .select("*")
            .eq("user_id", user.id);

          if (dbPers) {
            const mapped: PersonalVaultEntry[] = dbPers.map((e) => ({
              id: e.id,
              label: e.label || e.title || "",
              notes: e.notes || "",
              fields: e.fields || [],
              username: e.username || "Me",
              createdAt: e.created_at || new Date().toISOString(),
              updatedAt: e.updated_at || new Date().toISOString(),
            }));
            setPersonalVault(mapped);
          }
        } catch (e) {
          console.error("Error loading personal vault from Supabase:", e);
        }
      }
    }

    loadVault();
  }, [user]);

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
        const { error } = await supabase.from("tickets").delete().eq("id", id);
        if (error) throw error;
        setTickets((prev) => prev.filter((t) => t.id !== id));
      } catch (e: any) {
        console.error("Supabase ticket delete error, deleting locally:", e?.message || e);
        deleteTicketLocal(id);
      }
    } else {
      deleteTicketLocal(id);
    }
  };

  const deleteTicketLocal = (id: string) => {
    saveTicketsLocal(tickets.filter((t) => t.id !== id));
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

        teamMembers,
        addTeamMember: (name) => {
          const trimmed = name.trim();
          if (!trimmed || teamMembers.includes(trimmed)) return;
          const updated = [...teamMembers, trimmed];
          setTeamMembers(updated);
        },
        removeTeamMember: (name) => {
          const updated = teamMembers.filter((m) => m !== name);
          setTeamMembers(updated);
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
            }
          }
        },
        addRosterMember: (member) => {
          // Dynamic database active profiles are mapped to roster members instead
        },
        removeRosterMember: (employeeId) => {
          // Dynamic database active profiles are mapped to roster members instead
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
              }
            } catch (err) {
              console.error("Error submitting shift request:", err);
            }
          }
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
        updateMasterPassword: (newPin) => {
          setMasterPasswordState(newPin);
          if (typeof window !== "undefined") {
            localStorage.setItem("nestor_master_password", newPin);
          }
        },
        addVaultProductGroup: async (category, productName) => {
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
              console.error("Supabase insert product group error:", e);
            }
          }
          setVaultProducts((prev) => {
            const updated = [...prev, newGroup];
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        removeVaultProductGroup: async (productId) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_products").delete().eq("id", productId);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase delete product group error:", e);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.filter((p) => p.id !== productId);
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        addVaultClientSection: async (productId, clientId, clientName) => {
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
              console.error("Supabase insert vault client error:", e);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              return { ...p, clients: [...p.clients, newClient] };
            });
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        removeVaultClientSection: async (productId, clientSectionId) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_clients").delete().eq("id", clientSectionId);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase delete vault client error:", e);
            }
          }
          setVaultProducts((prev) => {
            const updated = prev.map((p) => {
              if (p.id !== productId) return p;
              return { ...p, clients: p.clients.filter((c) => c.id !== clientSectionId) };
            });
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        addVaultEntry: async (productId, clientSectionId, entryData) => {
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
              const { error } = await supabase.from("vault_entries").insert({
                id: newId,
                product_id: productId,
                client_id: clientSectionId,
                title: entryData.label,
                fields: entryData.fields,
              });
              if (error) throw error;
            } catch (e) {
              console.error("Supabase insert vault entry error:", e);
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
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        updateVaultEntry: async (productId, clientSectionId, updatedEntry) => {
          const todayStr = new Date().toISOString().split("T")[0];
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase
                .from("vault_entries")
                .update({
                  title: updatedEntry.label,
                  fields: updatedEntry.fields,
                  updated_at: todayStr,
                })
                .eq("id", updatedEntry.id);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase update vault entry error:", e);
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
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        removeVaultEntry: async (productId, clientSectionId, entryId) => {
          if (isSupabaseConfigured && supabase) {
            try {
              const { error } = await supabase.from("vault_entries").delete().eq("id", entryId);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase delete vault entry error:", e);
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
            localStorage.setItem("nestor_vault_products", JSON.stringify(updated));
            return updated;
          });
        },
        addPersonalVaultEntry: async (entryData) => {
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
              const { error } = await supabase.from("personal_vault").insert({
                id: newId,
                user_id: user.id,
                title: entryData.label,
                fields: entryData.fields,
                username: username || "Me",
              });
              if (error) throw error;
            } catch (e) {
              console.error("Supabase insert personal vault entry error:", e);
            }
          }
          setPersonalVault((prev) => {
            const updated = [...prev, newEntry];
            localStorage.setItem("nestor_personal_vault", JSON.stringify(updated));
            return updated;
          });
        },
        updatePersonalVaultEntry: async (updatedEntry) => {
          const todayStr = new Date().toISOString().split("T")[0];
          if (isSupabaseConfigured && supabase && user) {
            try {
              const { error } = await supabase
                .from("personal_vault")
                .update({
                  title: updatedEntry.label,
                  fields: updatedEntry.fields,
                  updated_at: todayStr,
                })
                .eq("id", updatedEntry.id);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase update personal vault entry error:", e);
            }
          }
          setPersonalVault((prev) => {
            const updated = prev.map((e) => (e.id === updatedEntry.id ? { ...updatedEntry, updatedAt: todayStr } : e));
            localStorage.setItem("nestor_personal_vault", JSON.stringify(updated));
            return updated;
          });
        },
        removePersonalVaultEntry: async (id) => {
          if (isSupabaseConfigured && supabase && user) {
            try {
              const { error } = await supabase.from("personal_vault").delete().eq("id", id);
              if (error) throw error;
            } catch (e) {
              console.error("Supabase delete personal vault entry error:", e);
            }
          }
          setPersonalVault((prev) => {
            const updated = prev.filter((e) => e.id !== id);
            localStorage.setItem("nestor_personal_vault", JSON.stringify(updated));
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
