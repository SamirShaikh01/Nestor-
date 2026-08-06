"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ShieldCheck, TriangleAlert } from "lucide-react";

interface RecoveryCodeModalProps {
  code: string | null;
  title: string;
  onClose: () => void;
}

export function RecoveryCodeModal({ code, title, onClose }: RecoveryCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setConfirmedSaved(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {code && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="z-10 w-full max-w-md rounded-card border shadow-glow dark:border-white/10 dark:bg-[#0c1220] bg-white p-6 space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-accent-cyan/10 p-2 text-accent-cyan flex-shrink-0">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-text-primary">{title}</h3>
            </div>

            <div className="rounded-input border border-danger/30 bg-danger/5 p-3 flex items-start gap-2">
              <TriangleAlert size={16} className="text-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-soft leading-relaxed">
                This code is shown <strong>once</strong>. Save it somewhere safe (a password
                manager, printed and locked away) — if you ever forget your password/PIN, this is
                the only other way back in. If you lose both, the data is unrecoverable.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-input border border-white/10 bg-[#0d1424] px-4 py-3">
              <code className="flex-1 text-sm font-mono font-bold tracking-wider text-accent-cyan break-all">
                {code}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className={`rounded p-2 transition-colors cursor-pointer flex-shrink-0 ${
                  copied ? "bg-accent-cyan/20 text-accent-cyan" : "text-text-soft hover:text-text-primary hover:bg-white/10"
                }`}
                title="Copy to clipboard"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>

            <label className="flex items-start gap-2 text-xs text-text-soft cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="mt-0.5"
              />
              <span>I have saved this recovery code somewhere safe.</span>
            </label>

            <button
              type="button"
              onClick={handleClose}
              disabled={!confirmedSaved}
              className="w-full rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-2.5 text-xs font-bold text-white shadow-glow hover:scale-[1.01] transition-all uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
