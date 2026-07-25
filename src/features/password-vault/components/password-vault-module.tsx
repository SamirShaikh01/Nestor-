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
  Settings,
  X,
} from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";
import type { VaultProductGroup, VaultClientSection, VaultEntry, PersonalVaultEntry, VaultField } from "../types";
import { AddEntryModal } from "./add-entry-modal";
import { AddProductModal } from "./add-product-modal";

export function PasswordVaultModule() {
  const {
    vaultProducts,
    personalVault,
    masterPassword,
    updateMasterPassword,
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
  } = useNestor();

  // Unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [oldPinInput, setOldPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");

  // Navigation State
  const [activeTab, setActiveTab] = useState<"products" | "personal">("products");
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

  // Handle PIN Change
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPinInput !== masterPassword) {
      alert("Current master password is incorrect.");
      return;
    }
    if (!newPinInput.trim()) return;
    updateMasterPassword(newPinInput.trim());
    setIsChangePinOpen(false);
    setOldPinInput("");
    setNewPinInput("");
    alert("Master password updated successfully!");
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
          >
            <Settings size={14} /> Master PIN
          </button>
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
                <button
                  onClick={() => setIsAddProductOpen(true)}
                  className="text-xs font-bold text-accent-cyan hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Product
                </button>
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
                                      </div>
                                    );
                                  })}

                                  {/* Add Client Inline Button */}
                                  {addingClientForProduct === prod.id ? (
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
                                  )}
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
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingEntry(null);
                  setIsAddEntryOpen(true);
                }}
                className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-4 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus size={15} /> Add Credential Set
              </button>
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
                              {f.isSecret && !isRevealed ? "••••••••••••" : f.value || "—"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {f.isSecret && (
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
                              {f.isSecret && !isRevealed ? "••••••••••••" : f.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {f.isSecret && (
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
                <h3 className="text-sm font-bold text-text-primary">Change Master Password</h3>
                <button onClick={() => setIsChangePinOpen(false)} className="text-text-soft">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleChangePin} className="space-y-3">
                <div>
                  <label className="block text-xs text-text-soft mb-1 font-semibold">Current Master PIN</label>
                  <input
                    type="password"
                    required
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value)}
                    className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-soft mb-1 font-semibold">New Master PIN</label>
                  <input
                    type="password"
                    required
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    className="w-full rounded-input border px-3 py-2 text-xs text-text-primary dark:bg-[#0d1424] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-btn bg-accent-cyan py-2 text-xs font-bold text-white uppercase tracking-wider cursor-pointer"
                >
                  Update Master Password
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
