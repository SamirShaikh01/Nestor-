"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Lock,
  Unlock,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  User,
  Building,
  Server,
  Database,
  Globe,
  X,
  LifeBuoy,
  TriangleAlert,
} from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import type { VaultProductGroup, VaultClientSection, VaultEntry, PersonalVaultEntry, VaultField, VaultChangeRequest } from "../types";
import { AddEntryModal } from "./add-entry-modal";
import { AddProductModal } from "./add-product-modal";
import { RecoveryCodeModal } from "@/src/shared/components/ui/recovery-code-modal";
import { Send, Clock, CheckCircle2, XCircle } from "lucide-react";

export function PasswordVaultModule() {
  const {
    vaultProducts,
    personalVault,
    masterPassword,
    personalVaultPin,
    updatePersonalVaultPin,
    personalVaultRecoveryKitActive,
    setupPersonalVaultRecoveryKit,
    recoverPersonalVaultWithCode,
    resetPersonalVault,
    vaultChangeRequests,
    submitVaultChangeRequest,
    reviewVaultChangeRequest,
    addVaultProductGroup,
    removeVaultProductGroup,
    addVaultClientSection,
    removeVaultClientSection,
    addVaultEntry,
    updateVaultEntry,
    removeVaultEntry,
    addPersonalVaultEntry,
    updatePersonalVaultEntry,
    removePersonalVaultEntry,
    username,
    role,
  } = useNestor();

  const isAdmin = role === "admin";

  // Unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [oldPinInput, setOldPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Personal Vault Recovery Kit
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
      const code = await setupPersonalVaultRecoveryKit();
      if (code) {
        setRecoveryCodeModalTitle("Personal Vault Recovery Code");
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
      alert("New PIN and confirmation do not match.");
      return;
    }
    setIsRecovering(true);
    try {
      const ok = await recoverPersonalVaultWithCode(recoverCodeInput, recoverNewPin.trim());
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
      alert('Type "RESET" to confirm — this permanently deletes every entry in your personal vault.');
      return;
    }
    if (!resetNewPin.trim()) return;
    if (resetNewPin !== resetConfirmPin) {
      alert("New PIN and confirmation do not match.");
      return;
    }
    setIsResetting(true);
    try {
      const code = await resetPersonalVault(resetNewPin.trim());
      if (code) {
        setShowResetForm(false);
        setResetConfirmText("");
        setResetNewPin("");
        setResetConfirmPin("");
        setRecoveryCodeModalTitle("New Personal Vault Recovery Code");
        setRevealedRecoveryCode(code);
      }
    } finally {
      setIsResetting(false);
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState<"products" | "personal" | "requests">("products");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ AV: true, EDR: true, PAM: true });
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Copy state feedback: key -> copied
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);

  // Mask toggles: fieldId -> isRevealed
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});

  // Modals
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);

  // Change Request modal (member proposes a new value for one field)
  const [requestTarget, setRequestTarget] = useState<{ entryId: string; entryLabel: string; fieldId: string; fieldKey: string } | null>(null);
  const [requestNewValue, setRequestNewValue] = useState("");
  const [requestSecureUrl, setRequestSecureUrl] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<number | null>(null);

  // Add Client inline state
  const [newClientId, setNewClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [addingClientForProduct, setAddingClientForProduct] = useState<string | null>(null);

  // Handle Master Password Unlock
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin === masterPassword) {
      setIsUnlocked(true);
      setPinError("");
    } else {
      setPinError("Invalid Master Password. Try '1234' or your custom PIN.");
    }
  };

  // Handle Personal Vault PIN change — re-encrypts the user's own personal
  // vault entries under the hood. The Team Master Password now lives in
  // Settings → Password Vault Security (admin-only), not here.
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPinInput !== personalVaultPin) {
      alert("Current personal PIN is incorrect.");
      return;
    }
    if (!newPinInput.trim()) return;
    if (newPinInput !== confirmPinInput) {
      alert("New PIN and confirmation do not match.");
      return;
    }

    setIsSavingPin(true);
    try {
      await updatePersonalVaultPin(newPinInput.trim());
      setIsChangePinOpen(false);
      setOldPinInput("");
      setNewPinInput("");
      setConfirmPinInput("");
    } finally {
      setIsSavingPin(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFieldId(fieldId);
    setTimeout(() => setCopiedFieldId(null), 2000);
  };

  // Toggle Mask
  const toggleSecretReveal = (fieldId: string) => {
    setRevealedFields((prev) => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  // Defensive masking: some existing fields were saved with isSecret=false
  // (e.g. an older entry, or the checkbox was left unticked) even though the
  // field name is clearly a credential. Rather than trust that flag alone,
  // also mask anything whose key reads like a secret.
  const SENSITIVE_KEY_PATTERN = /pass|secret|token|key|credential|pin/i;
  const isFieldSensitive = (f: VaultField) => f.isSecret || SENSITIVE_KEY_PATTERN.test(f.key);

  // Group Products by Category
  const categoryGroups = useMemo(() => {
    const map: Record<string, VaultProductGroup[]> = {};
    vaultProducts.forEach((p) => {
      const cat = p.category || "General";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return map;
  }, [vaultProducts]);

  // Selected Product and Client objects
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return vaultProducts[0] || null;
    return vaultProducts.find((p) => p.id === selectedProductId) || null;
  }, [selectedProductId, vaultProducts]);

  const selectedClientSection = useMemo(() => {
    if (!selectedProduct) return null;
    if (!selectedClientId) return selectedProduct.clients[0] || null;
    return selectedProduct.clients.find((c) => c.id === selectedClientId) || null;
  }, [selectedProduct, selectedClientId]);

  // Filtered Entries (Search)
  const filteredProductEntries = useMemo(() => {
    if (!selectedClientSection) return [];
    if (!searchQuery.trim()) return selectedClientSection.entries;

    const q = searchQuery.toLowerCase();
    return selectedClientSection.entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q)) ||
        e.fields.some((f) => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q))
    );
  }, [selectedClientSection, searchQuery]);

  // Personal Entries
  const personalEntries = useMemo(() => {
    if (!searchQuery.trim()) return personalVault;
    const q = searchQuery.toLowerCase();
    return personalVault.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.fields.some((f) => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q))
    );
  }, [personalVault, searchQuery]);

  // Save Entry (Add or Update)
  const handleSaveEntry = (label: string, fields: VaultField[], notes: string) => {
    if (activeTab === "products" && selectedProduct && selectedClientSection) {
      if (editingEntry) {
        updateVaultEntry(selectedProduct.id, selectedClientSection.id, {
          ...editingEntry,
          label,
          fields,
          notes,
        });
      } else {
        addVaultEntry(selectedProduct.id, selectedClientSection.id, {
          label,
          fields,
          notes,
          addedBy: username || "Admin",
        });
      }
    } else if (activeTab === "personal") {
      if (editingEntry) {
        updatePersonalVaultEntry({
          ...editingEntry,
          username: username || "Me",
          label,
          fields,
          notes,
        });
      } else {
        addPersonalVaultEntry({
          label,
          fields,
          notes,
        });
      }
    }
    setEditingEntry(null);
  };

  // Add Client Section to Product
  const handleAddClientSection = (productId: string) => {
    if (!newClientId.trim() || !newClientName.trim()) return;
    addVaultClientSection(productId, newClientId.trim(), newClientName.trim());
    setNewClientId("");
    setNewClientName("");
    setAddingClientForProduct(null);
  };

  // Change Requests — every user can see the team vault's entries/fields
  // (RLS allows read for everyone), so labels can always be resolved locally
  // regardless of whether the viewer is the requester or an admin.
  const findEntryAndField = (entryId: string, fieldId: string): { entry: VaultEntry; field: VaultField } | null => {
    for (const p of vaultProducts) {
      for (const c of p.clients) {
        const entry = c.entries.find((e) => e.id === entryId);
        if (entry) {
          const field = entry.fields.find((f) => f.id === fieldId);
          if (field) return { entry, field };
          return { entry, field: { id: fieldId, key: "(deleted field)", value: "", isSecret: false } };
        }
      }
    }
    return null;
  };

  const myPendingRequests = useMemo(
    () => vaultChangeRequests.filter((r) => r.status === "pending"),
    [vaultChangeRequests]
  );

  const openRequestModal = (entry: VaultEntry, field: VaultField) => {
    setRequestTarget({ entryId: entry.id, entryLabel: entry.label, fieldId: field.id, fieldKey: field.key });
    setRequestNewValue("");
    setRequestSecureUrl("");
    setRequestReason("");
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTarget || (!requestNewValue.trim() && !requestSecureUrl.trim()) || !requestReason.trim()) return;
    // A malicious "secure link" like javascript:alert(1) would otherwise sit
    // waiting as a clickable <a href> in the admin's Requests queue — reject
    // any scheme but http(s) here so nothing unsafe ever gets encrypted and
    // stored in the first place.
    const trimmedUrl = requestSecureUrl.trim();
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      alert("Secure Link must be a valid http:// or https:// URL.");
      return;
    }
    setIsSubmittingRequest(true);
    try {
      const ok = await submitVaultChangeRequest(
        requestTarget.entryId,
        requestTarget.fieldId,
        requestNewValue.trim(),
        requestReason.trim(),
        requestSecureUrl.trim()
      );
      if (ok) {
        setRequestTarget(null);
        setRequestNewValue("");
        setRequestSecureUrl("");
        setRequestReason("");
      }
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleReviewRequest = async (requestId: number, decision: "approved" | "rejected") => {
    setReviewingRequestId(requestId);
    try {
      await reviewVaultChangeRequest(requestId, decision);
    } finally {
      setReviewingRequestId(null);
    }
  };

  // -------------------------------------------------------------
  // LOCK SCREEN VIEW
  // -------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md rounded-card border p-8 shadow-glow dark:border-white/10 dark:bg-card-bg bg-white text-center space-y-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-cyan/10 text-accent-cyan mb-2 shadow-inner">
            <Lock size={32} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">Password Vault Locked</h2>
            <p className="text-xs text-text-soft mt-1">
              Enter your Master Password to access team and personal credentials.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                Master Password *
              </label>
              <input
                type="password"
                required
                autoFocus
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                placeholder="Enter PIN (Default: 1234)"
                className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent-cyan transition-all"
              />
            </div>

            {pinError && (
              <p className="text-xs text-danger font-medium flex items-center gap-1.5">
                <ShieldAlert size={14} /> {pinError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-3 text-sm font-bold text-white shadow-glow hover:scale-[1.02] transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock size={16} /> Unlock Vault
            </button>
          </form>

          <p className="text-[11px] text-text-muted">
            Default master password is <code className="text-accent-cyan font-bold">1234</code>. You can change it anytime inside settings.
          </p>
        </motion.div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UNLOCKED KEEPASS2-STYLE SPLIT PANE VIEW
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight flex items-center gap-2.5">
            <KeyRound size={26} className="text-accent-cyan" /> Password Vault
          </h1>
          <p className="text-xs text-text-soft mt-1">
            KeePass2-style secure credential manager for MSS team setup &amp; private entries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsChangePinOpen(true)}
            className="flex items-center gap-1.5 rounded-btn border px-3 py-2 text-xs font-bold text-text-soft hover:text-text-primary border-slate-200 dark:border-white/10 dark:bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            title="Change the PIN that protects your own personal vault"
          >
            <User size={14} /> My Personal PIN
          </button>
          {isAdmin && (
            <span className="text-[10px] text-text-soft italic hidden sm:inline">
              Team Master Password is managed in Settings → Password Vault Security
            </span>
          )}
          <button
            onClick={() => setIsUnlocked(false)}
            className="flex items-center gap-1.5 rounded-btn border border-danger/30 bg-danger/10 px-3.5 py-2 text-xs font-bold text-danger hover:bg-danger hover:text-white transition-all cursor-pointer"
          >
            <Lock size={14} /> Lock Vault
          </button>
        </div>
      </div>

      {/* ── Main Split Pane Container ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* ── LEFT PANEL (Tree Navigator) ── */}
        <div className="lg:col-span-4 rounded-card border shadow-soft p-4 dark:border-white/10 dark:bg-card-bg bg-white flex flex-col gap-4">
          {/* Tab Switch: Team Products vs Personal */}
          <div className="flex rounded-input border p-1 dark:border-white/10 dark:bg-white/5 bg-slate-100">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex-1 py-1.5 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "products"
                  ? "bg-accent-cyan text-white shadow-sm"
                  : "text-text-soft hover:text-text-primary"
              }`}
            >
              <Building size={14} /> Team Products
            </button>
            <button
              onClick={() => setActiveTab("personal")}
              className={`flex-1 py-1.5 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "personal"
                  ? "bg-accent-purple text-white shadow-sm"
                  : "text-text-soft hover:text-text-primary"
              }`}
            >
              <User size={14} /> Personal Vault
            </button>
            <button
              onClick={() => setActiveTab("requests")}
              className={`relative flex-1 py-1.5 text-xs font-bold rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "requests"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-text-soft hover:text-text-primary"
              }`}
            >
              <Clock size={14} /> Requests
              {myPendingRequests.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold">
                  {myPendingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search credentials, IPs, domains..."
              className="w-full rounded-input border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0d1424] pl-9 pr-3 py-2 text-xs text-text-primary outline-none focus:border-accent-cyan"
            />
          </div>

          {/* TREE VIEW CONTENT */}
          {activeTab === "products" && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-soft">Product Groups</span>
                {isAdmin && (
                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="text-xs font-bold text-accent-cyan hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Add Product
                  </button>
                )}
              </div>

              {/* Grouped Tree Items */}
              {Object.entries(categoryGroups).map(([catName, prods]) => {
                const isCatExpanded = expandedCategories[catName] !== false;
                return (
                  <div key={catName} className="space-y-1">
                    {/* Category Level Header */}
                    <button
                      onClick={() =>
                        setExpandedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }))
                      }
                      className="w-full flex items-center gap-1.5 text-xs font-bold text-text-primary hover:text-accent-cyan py-1 px-1 rounded transition-colors text-left"
                    >
                      {isCatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Folder size={14} className="text-accent-cyan" />
                      <span>{catName}</span>
                      <span className="ml-auto text-[10px] text-text-soft font-mono font-normal">
                        ({prods.length})
                      </span>
                    </button>

                    {/* Products Level */}
                    {isCatExpanded && (
                      <div className="pl-4 space-y-1 border-l-2 dark:border-white/5 border-slate-200 ml-2">
                        {prods.map((prod) => {
                          const isProdSelected = selectedProductId === prod.id || (!selectedProductId && prod === vaultProducts[0]);
                          const isProdExpanded = expandedProducts[prod.id] !== false;

                          return (
                            <div key={prod.id} className="space-y-1">
                              <div className="flex items-center justify-between group">
                                <button
                                  onClick={() => {
                                    setSelectedProductId(prod.id);
                                    if (prod.clients.length > 0) setSelectedClientId(prod.clients[0].id);
                                    setExpandedProducts((prev) => ({ ...prev, [prod.id]: !prev[prod.id] }));
                                  }}
                                  className={`flex-1 flex items-center gap-1.5 py-1 px-2 rounded text-xs transition-all text-left ${
                                    isProdSelected
                                      ? "bg-accent-cyan/15 text-accent-cyan font-bold"
                                      : "text-text-muted hover:text-text-primary hover:bg-white/5"
                                  }`}
                                >
                                  {isProdExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>{prod.productName}</span>
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete product group '${prod.productName}'?`)) {
                                        removeVaultProductGroup(prod.id);
                                      }
                                    }}
                                    className="text-text-soft hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Product"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Clients Level */}
                              {isProdExpanded && (
                                <div className="pl-4 space-y-0.5 border-l dark:border-white/5 border-slate-200 ml-2">
                                  {prod.clients.map((cli) => {
                                    const isCliSelected = isProdSelected && selectedClientId === cli.id;
                                    return (
                                      <div key={cli.id} className="flex items-center justify-between group">
                                        <button
                                          onClick={() => {
                                            setSelectedProductId(prod.id);
                                            setSelectedClientId(cli.id);
                                          }}
                                          className={`flex-1 text-left py-1 px-2 rounded text-[11px] font-mono transition-all truncate ${
                                            isCliSelected
                                              ? "bg-accent-cyan text-white font-bold shadow-xs"
                                              : "text-text-soft hover:text-text-primary hover:bg-white/5"
                                          }`}
                                        >
                                          {cli.clientId} — {cli.clientName}
                                        </button>
                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (confirm(`Delete client setup '${cli.clientId} — ${cli.clientName}' from ${prod.productName}?`)) {
                                                removeVaultClientSection(prod.id, cli.id);
                                                if (selectedClientId === cli.id) setSelectedClientId(null);
                                              }
                                            }}
                                            className="text-text-soft hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-pointer"
                                            title="Delete Client Setup"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Add Client Inline Button */}
                                  {isAdmin && (addingClientForProduct === prod.id ? (
                                    <div className="p-2 rounded border border-accent-cyan/40 bg-accent-cyan/5 space-y-2 mt-1">
                                      <input
                                        type="text"
                                        placeholder="Client ID (e.g. 4130)"
                                        value={newClientId}
                                        onChange={(e) => setNewClientId(e.target.value)}
                                        className="w-full rounded px-2 py-1 text-[10px] bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/10 text-text-primary outline-none"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Client Name (e.g. SIDBI)"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="w-full rounded px-2 py-1 text-[10px] bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/10 text-text-primary outline-none"
                                      />
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          onClick={() => setAddingClientForProduct(null)}
                                          className="px-2 py-0.5 text-[9px] text-text-soft"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleAddClientSection(prod.id)}
                                          className="px-2 py-0.5 text-[9px] font-bold bg-accent-cyan text-white rounded"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setAddingClientForProduct(prod.id)}
                                      className="text-[10px] text-accent-cyan hover:underline py-1 px-2 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus size={11} /> Add Client Setup
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "personal" && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="p-3 rounded-input bg-accent-purple/10 border border-accent-purple/20 text-xs text-text-soft">
                🔒 <strong>Personal Vault</strong> entries are user-specific and visible only to your account.
              </div>
              {personalVault.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-input border border-slate-200 dark:border-white/10 dark:bg-white/5 bg-slate-50 flex items-center justify-between group"
                >
                  <span className="text-xs font-semibold text-text-primary truncate">{p.label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingEntry(p as any);
                        setIsAddEntryOpen(true);
                      }}
                      className="text-text-soft hover:text-accent-cyan p-1 cursor-pointer"
                      title="Edit Personal Credential"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete personal credential '${p.label}'?`)) {
                          removePersonalVaultEntry(p.id);
                        }
                      }}
                      className="text-text-soft hover:text-danger p-1 cursor-pointer"
                      title="Delete Personal Credential"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "requests" && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="p-3 rounded-input bg-amber-500/10 border border-amber-500/20 text-xs text-text-soft">
                🔔 {isAdmin
                  ? "Review credential update requests submitted by members."
                  : "Track the status of credential updates you've requested."}
              </div>
              {(isAdmin ? vaultChangeRequests : vaultChangeRequests.filter((r) => r.requesterName === username)).length === 0 && (
                <p className="text-xs text-text-muted px-1">No requests yet.</p>
              )}
              {(isAdmin ? vaultChangeRequests : vaultChangeRequests.filter((r) => r.requesterName === username)).map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-input border border-slate-200 dark:border-white/10 dark:bg-white/5 bg-slate-50 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-text-primary truncate">
                    {findEntryAndField(r.entryId, r.fieldId)?.entry.label || "Unknown"} · {findEntryAndField(r.entryId, r.fieldId)?.field.key || r.fieldId}
                  </span>
                  {r.status === "pending" && <Clock size={13} className="text-amber-500 flex-shrink-0" />}
                  {r.status === "approved" && <CheckCircle2 size={13} className="text-success flex-shrink-0" />}
                  {r.status === "rejected" && <XCircle size={13} className="text-danger flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL (Credential Viewer & Entry List) ── */}
        <div className="lg:col-span-8 rounded-card border shadow-soft p-6 dark:border-white/10 dark:bg-card-bg bg-white flex flex-col gap-6">
          {/* Header Banner */}
          {activeTab === "products" && selectedProduct && selectedClientSection && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-2 dark:border-white/10">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent-cyan px-2 py-0.5 rounded bg-accent-cyan/10">
                  {selectedProduct.category} › {selectedProduct.productName}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Building size={18} className="text-text-soft" />
                    {selectedClientSection.clientId} — {selectedClientSection.clientName}
                  </h3>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete client setup '${selectedClientSection.clientId} — ${selectedClientSection.clientName}' and all its credentials?`)) {
                          removeVaultClientSection(selectedProduct.id, selectedClientSection.id);
                          setSelectedClientId(null);
                        }
                      }}
                      className="rounded-btn p-1 text-text-soft hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                      title="Delete Client Setup"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingEntry(null);
                    setIsAddEntryOpen(true);
                  }}
                  className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus size={15} /> Add Credential Set
                </button>
              )}
            </div>
          )}

          {activeTab === "personal" && (
            <div className="flex items-center justify-between border-b pb-4 dark:border-white/10">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent-purple px-2 py-0.5 rounded bg-accent-purple/10">
                  Personal Vault
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1 flex items-center gap-2">
                  <User size={18} className="text-text-soft" /> Private Credentials for {username}
                </h3>
              </div>

              <button
                onClick={() => {
                  setEditingEntry(null);
                  setIsAddEntryOpen(true);
                }}
                className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} /> Add Personal Credential
              </button>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="flex items-center justify-between border-b pb-4 dark:border-white/10">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 px-2 py-0.5 rounded bg-amber-500/10">
                  Change Requests
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1 flex items-center gap-2">
                  <Clock size={18} className="text-text-soft" />
                  {isAdmin ? "Change Request Queue" : "Your Change Requests"}
                </h3>
              </div>
            </div>
          )}

          {/* CREDENTIAL SET CARDS LIST */}
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {activeTab === "products" &&
              filteredProductEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-card border p-4 dark:border-white/10 dark:bg-white/[0.02] bg-slate-50 border-slate-200 space-y-3 hover:border-accent-cyan/40 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-accent-cyan" />
                      <h4 className="text-sm font-bold text-text-primary">{entry.label}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-text-soft">Added by {entry.addedBy || "Admin"}</span>
                      {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingEntry(entry);
                          setIsAddEntryOpen(true);
                        }}
                        className="rounded p-1 text-text-soft hover:text-accent-cyan hover:bg-white/10 transition-colors"
                        title="Edit Credential Set"
                      >
                        <Edit2 size={13} />
                      </button>
                      )}
                      {isAdmin && (
                      <button
                        onClick={() => {
                          if (selectedProduct && selectedClientSection && confirm(`Delete '${entry.label}'?`)) {
                            removeVaultEntry(selectedProduct.id, selectedClientSection.id, entry.id);
                          }
                        }}
                        className="rounded p-1 text-text-soft hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete Credential Set"
                      >
                        <Trash2 size={13} />
                      </button>
                      )}
                    </div>
                  </div>

                  {entry.notes && (
                    <p className="text-xs text-text-soft italic bg-slate-100 dark:bg-white/5 p-2 rounded">
                      Note: {entry.notes}
                    </p>
                  )}

                  {/* Fields Grid */}
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {entry.fields.map((f) => {
                      const isRevealed = revealedFields[f.id];
                      const isCopied = copiedFieldId === f.id;
                      const sensitive = isFieldSensitive(f);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-input border p-2.5 dark:border-white/5 dark:bg-[#090e1a] bg-white border-slate-200 shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-soft block truncate">
                              {f.key}
                            </span>
                            <span className="text-xs font-mono font-semibold text-text-primary block truncate">
                              {sensitive && !isRevealed ? "••••••••••••" : f.value || "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {sensitive && (
                              <button
                                onClick={() => toggleSecretReveal(f.id)}
                                className="p-1 rounded text-text-soft hover:text-text-primary transition-colors cursor-pointer"
                                title={isRevealed ? "Mask Secret" : "Reveal Secret"}
                              >
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}

                            <button
                              onClick={() => handleCopy(f.value, f.id)}
                              className={`p-1.5 rounded transition-all cursor-pointer ${
                                isCopied
                                  ? "bg-accent-cyan/20 text-accent-cyan font-bold"
                                  : "text-text-soft hover:text-text-primary hover:bg-white/10"
                              }`}
                              title="Copy to clipboard"
                            >
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                            </button>

                            {!isAdmin && (
                              <button
                                onClick={() => openRequestModal(entry, f)}
                                className="p-1.5 rounded text-text-soft hover:text-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer"
                                title={`Request an update to ${f.key}`}
                              >
                                <Send size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {activeTab === "products" && filteredProductEntries.length === 0 && (
              <div className="text-center py-16 space-y-2 text-text-soft">
                <KeyRound size={32} className="mx-auto text-text-muted opacity-50" />
                <p className="text-sm font-semibold">No credential sets found for this setup.</p>
                <p className="text-xs text-text-muted">
                  Click "+ Add Credential Set" above to add VPN, Server, DB, or custom credentials.
                </p>
              </div>
            )}

            {activeTab === "personal" &&
              personalEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-card border p-4 dark:border-white/10 dark:bg-white/[0.02] bg-slate-50 border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between border-b pb-2 dark:border-white/5">
                    <h4 className="text-sm font-bold text-text-primary">{entry.label}</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingEntry(entry as any);
                          setIsAddEntryOpen(true);
                        }}
                        className="rounded p-1 text-text-soft hover:text-accent-cyan hover:bg-white/10 transition-colors cursor-pointer"
                        title="Edit Personal Credential"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete personal credential '${entry.label}'?`)) {
                            removePersonalVaultEntry(entry.id);
                          }
                        }}
                        className="rounded p-1 text-text-soft hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                        title="Delete Personal Credential"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    {entry.fields.map((f) => {
                      const isRevealed = revealedFields[f.id];
                      const isCopied = copiedFieldId === f.id;
                      const sensitive = isFieldSensitive(f);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center justify-between rounded-input border p-2.5 dark:border-white/5 dark:bg-[#090e1a] bg-white border-slate-200"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-[10px] font-bold uppercase text-text-soft block truncate">
                              {f.key}
                            </span>
                            <span className="text-xs font-mono font-semibold text-text-primary block truncate">
                              {sensitive && !isRevealed ? "••••••••••••" : f.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sensitive && (
                              <button onClick={() => toggleSecretReveal(f.id)} className="p-1 text-text-soft">
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                            <button onClick={() => handleCopy(f.value, f.id)} className="p-1 text-text-soft">
                              {isCopied ? <Check size={13} /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {activeTab === "requests" &&
              (isAdmin ? vaultChangeRequests : vaultChangeRequests.filter((r) => r.requesterName === username)).map((r) => {
                const target = findEntryAndField(r.entryId, r.fieldId);
                const requestFieldKey = `req-${r.id}`;
                const isValueRevealed = revealedFields[requestFieldKey];
                return (
                  <div
                    key={r.id}
                    className="rounded-card border p-4 dark:border-white/10 dark:bg-white/[0.02] bg-slate-50 border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b pb-2 dark:border-white/5 gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text-primary truncate">
                          {target?.entry.label || "Unknown credential set"} · {target?.field.key || r.fieldId}
                        </h4>
                        <p className="text-[10px] text-text-soft">
                          Requested by {r.requesterName} on {new Date(r.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          r.status === "pending"
                            ? "bg-amber-500/10 text-amber-500"
                            : r.status === "approved"
                            ? "bg-success/10 text-success"
                            : "bg-danger/10 text-danger"
                        }`}
                      >
                        {r.status === "pending" && <Clock size={11} />}
                        {r.status === "approved" && <CheckCircle2 size={11} />}
                        {r.status === "rejected" && <XCircle size={11} />}
                        {r.status}
                      </span>
                    </div>

                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {r.newValue && (
                        <div className="rounded-input border p-2.5 dark:border-white/5 dark:bg-[#090e1a] bg-white border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold uppercase text-text-soft block">Proposed New Value</span>
                            <span className="text-xs font-mono font-semibold text-text-primary block break-all">
                              {isValueRevealed ? r.newValue : "••••••••••••"}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleSecretReveal(requestFieldKey)}
                            className="p-1 rounded text-text-soft hover:text-text-primary transition-colors cursor-pointer flex-shrink-0"
                            title={isValueRevealed ? "Mask" : "Reveal"}
                          >
                            {isValueRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      )}
                      {r.secureUrl && (
                        <div className="rounded-input border p-2.5 dark:border-white/5 dark:bg-[#090e1a] bg-white border-slate-200">
                          <span className="text-[10px] font-bold uppercase text-text-soft block">Secure Link</span>
                          {/* Defense in depth: submission already rejects non-http(s)
                              schemes, but never render an unsafe href (e.g. javascript:)
                              even if an old/malformed record somehow exists. */}
                          {/^https?:\/\//i.test(r.secureUrl) ? (
                            <a
                              href={r.secureUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono font-semibold text-accent-cyan hover:underline block break-all"
                            >
                              {r.secureUrl}
                            </a>
                          ) : (
                            <span className="text-xs font-mono text-danger block break-all" title="Blocked: not a valid http(s) link">
                              {r.secureUrl}
                            </span>
                          )}
                        </div>
                      )}
                      {r.reason && (
                        <div className="rounded-input border p-2.5 dark:border-white/5 dark:bg-[#090e1a] bg-white border-slate-200">
                          <span className="text-[10px] font-bold uppercase text-text-soft block">Reason</span>
                          <span className="text-xs text-text-primary block">{r.reason}</span>
                        </div>
                      )}
                    </div>

                    {isAdmin && r.status === "pending" && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => handleReviewRequest(r.id, "rejected")}
                          disabled={reviewingRequestId === r.id}
                          className="rounded-btn px-3 py-1.5 text-xs font-bold border border-danger/30 text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          <XCircle size={13} /> Disapprove
                        </button>
                        <button
                          onClick={() => handleReviewRequest(r.id, "approved")}
                          disabled={reviewingRequestId === r.id}
                          className="rounded-btn px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-accent-purple to-accent-cyan text-white shadow-glow hover:scale-105 transition-all cursor-pointer disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} /> Approve & Update
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {activeTab === "requests" &&
              (isAdmin ? vaultChangeRequests : vaultChangeRequests.filter((r) => r.requesterName === username)).length === 0 && (
                <div className="text-center py-16 space-y-2 text-text-soft">
                  <Clock size={32} className="mx-auto text-text-muted opacity-50" />
                  <p className="text-sm font-semibold">No change requests {isAdmin ? "to review" : "submitted"} yet.</p>
                  <p className="text-xs text-text-muted">
                    {isAdmin
                      ? "Requests from members proposing credential updates will appear here."
                      : 'Use the "send" icon next to a field in Team Vault to request an update.'}
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <AddProductModal isOpen={isAddProductOpen} onClose={() => setIsAddProductOpen(false)} />
      <AddEntryModal
        isOpen={isAddEntryOpen}
        onClose={() => setIsAddEntryOpen(false)}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
        clientName={selectedClientSection?.clientName}
        productName={selectedProduct?.productName}
      />

      {/* ── Change Request Submission Modal ── */}
      <AnimatePresence>
        {requestTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setRequestTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-card border p-6 dark:border-white/10 dark:bg-card-bg bg-white shadow-soft space-y-4"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 px-2 py-0.5 rounded bg-amber-500/10">
                  Request Update
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1">
                  {requestTarget.entryLabel} · {requestTarget.fieldKey}
                </h3>
                <p className="text-xs text-text-soft mt-1">
                  Propose a new value for this field. An admin will review and apply it.
                </p>
              </div>

              <form onSubmit={handleSubmitChangeRequest} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-soft block mb-1">
                    New Value {requestSecureUrl.trim() && <span className="normal-case font-normal text-text-muted">(optional if a secure link is given below)</span>}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={requestNewValue}
                    onChange={(e) => setRequestNewValue(e.target.value)}
                    placeholder={`New ${requestTarget.fieldKey}`}
                    className="w-full rounded-input px-3 py-2 text-sm bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/10 text-text-primary outline-none focus:border-accent-cyan"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-soft block mb-1">
                    Secure Link <span className="normal-case font-normal text-text-muted">(optional — e.g. a password-manager share link, if you'd rather not type the value directly)</span>
                  </label>
                  <input
                    type="url"
                    value={requestSecureUrl}
                    onChange={(e) => setRequestSecureUrl(e.target.value)}
                    placeholder="https://send.example.com/..."
                    className="w-full rounded-input px-3 py-2 text-sm bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/10 text-text-primary outline-none focus:border-accent-cyan"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-soft block mb-1">Reason</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder="e.g. Rotated the VPN password on 2026-08-06"
                    rows={3}
                    className="w-full rounded-input px-3 py-2 text-sm bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-white/10 text-text-primary outline-none focus:border-accent-cyan resize-none"
                    required
                  />
                </div>
                <p className="text-[10px] text-text-soft flex items-center gap-1">
                  🔒 Encrypted with the Team Vault key before it ever leaves your browser.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRequestTarget(null)}
                    className="rounded-btn px-3 py-1.5 text-xs font-bold text-text-soft hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRequest || (!requestNewValue.trim() && !requestSecureUrl.trim()) || !requestReason.trim()}
                    className="rounded-btn px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-accent-purple to-accent-cyan text-white shadow-glow hover:scale-105 transition-all cursor-pointer disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5"
                  >
                    <Send size={13} /> {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Master PIN Change Modal ── */}
      <AnimatePresence>
        {isChangePinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangePinOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="z-10 w-full max-w-sm rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0c1220] bg-white p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3 dark:border-white/10">
                <h3 className="text-sm font-bold text-text-primary">Change My Personal PIN</h3>
                <button onClick={() => setIsChangePinOpen(false)} className="text-text-soft">
                  <X size={16} />
                </button>
              </div>

              <p className="text-[11px] text-text-soft bg-accent-purple/5 border border-accent-purple/20 rounded-input p-2.5 leading-relaxed">
                This PIN only protects your own Personal Vault entries and is independent of the
                Team Vault master password — no one else is affected by changing it. (The shared
                Team Vault master password is managed by admins under Settings → Password Vault
                Security.)
              </p>

              <form onSubmit={handleChangePin} className="space-y-3">
                <div>
                  <label className="block text-xs text-text-soft mb-1 font-semibold">Current Personal PIN</label>
                  <input
                    type="password"
                    required
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value)}
                    className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-soft mb-1 font-semibold">New Personal PIN</label>
                  <input
                    type="password"
                    required
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-soft mb-1 font-semibold">Confirm New Personal PIN</label>
                  <input
                    type="password"
                    required
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPin}
                  className="w-full rounded-btn bg-accent-cyan py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSavingPin ? "Re-encrypting…" : "Update Personal PIN"}
                </button>
              </form>

              {/* ── Recovery Kit ── */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-soft flex items-center gap-1.5">
                    <LifeBuoy size={13} /> Recovery Kit
                  </h4>
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded-badge px-2 py-0.5 ${
                    personalVaultRecoveryKitActive ? "bg-success/15 text-success" : "bg-text-soft/10 text-text-soft"
                  }`}>
                    {personalVaultRecoveryKitActive ? "Active" : "Not Set Up"}
                  </span>
                </div>

                {!personalVaultRecoveryKitActive ? (
                  <div className="space-y-2">
                    <p className="text-xs text-text-soft leading-relaxed">
                      Without a Recovery Kit, forgetting your Personal PIN means every personal
                      entry is permanently unrecoverable. Set one up to get a one-time backup code
                      that restores access without losing any data.
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
                    A Recovery Kit is active. If your PIN is ever forgotten, use the recovery code
                    (shown once, at setup) to regain access below.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowRecoverForm((v) => !v); setShowResetForm(false); }}
                    className="text-xs font-semibold text-accent-cyan hover:underline cursor-pointer"
                  >
                    Forgot your PIN? Recover with code
                  </button>
                  <span className="text-text-soft text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => { setShowResetForm((v) => !v); setShowRecoverForm(false); }}
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
                          className="w-full rounded-input border px-3 py-2 text-xs font-mono text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">New Personal PIN</label>
                        <input
                          type="password"
                          required
                          value={recoverNewPin}
                          onChange={(e) => setRecoverNewPin(e.target.value)}
                          className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">Confirm New PIN</label>
                        <input
                          type="password"
                          required
                          value={recoverConfirmPin}
                          onChange={(e) => setRecoverConfirmPin(e.target.value)}
                          className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isRecovering}
                        className="w-full rounded-btn bg-accent-cyan py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        {isRecovering ? "Recovering…" : "Recover Personal Vault"}
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
                          This permanently <strong>deletes every entry in your Personal Vault</strong> —
                          they were encrypted under the forgotten PIN and cannot be salvaged. Only
                          use this if the recovery code is also lost.
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">Type RESET to confirm</label>
                        <input
                          type="text"
                          required
                          value={resetConfirmText}
                          onChange={(e) => setResetConfirmText(e.target.value)}
                          className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">New Personal PIN</label>
                        <input
                          type="password"
                          required
                          value={resetNewPin}
                          onChange={(e) => setResetNewPin(e.target.value)}
                          className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-soft mb-1">Confirm New PIN</label>
                        <input
                          type="password"
                          required
                          value={resetConfirmPin}
                          onChange={(e) => setResetConfirmPin(e.target.value)}
                          className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isResetting}
                        className="w-full rounded-btn bg-danger py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        {isResetting ? "Resetting…" : "Permanently Reset Personal Vault"}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RecoveryCodeModal
        code={revealedRecoveryCode}
        title={recoveryCodeModalTitle}
        onClose={() => setRevealedRecoveryCode(null)}
      />
    </div>
  );
}
