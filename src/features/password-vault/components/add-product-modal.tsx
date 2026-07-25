"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderPlus } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputCls =
  "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424] px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan transition-all";

export function AddProductModal({ isOpen, onClose }: AddProductModalProps) {
  const { addVaultProductGroup, productCategories } = useNestor();

  const [category, setCategory] = useState("AV");
  const [customCategory, setCustomCategory] = useState("");
  const [productName, setProductName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = category === "CUSTOM" ? customCategory.trim() : category.trim();
    if (!cat || !productName.trim()) return;

    addVaultProductGroup(cat, productName.trim());
    setProductName("");
    setCustomCategory("");
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
            className="absolute inset-0 bg-black/75 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="z-10 w-full max-w-md rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0c1220] light:border-slate-200 light:bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 dark:border-white/5 light:border-slate-100">
              <div className="flex items-center gap-2 text-accent-cyan">
                <FolderPlus size={18} />
                <h3 className="text-base font-semibold text-text-primary">Add Product Group</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-btn p-1 text-text-soft hover:bg-white/5 hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Category / Group *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  {(productCategories || ["AV", "EDR", "PAM", "DLP", "SIEM", "FIREWALL"]).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Add Custom Category...</option>
                </select>
              </div>

              {category === "CUSTOM" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                    Custom Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="e.g. DAM, WAF, NDR"
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-text-soft mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Trellix AV, Symantec AV, CyberArk PAM"
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-btn bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-text-soft hover:text-text-primary transition-all uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-5 py-2 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all uppercase"
                >
                  Add Product Group
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
