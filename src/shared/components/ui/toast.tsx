"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useNestor } from "@/src/shared/context/nestor-context";

export function ToastContainer() {
  const { toasts, dismissToast } = useNestor();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`pointer-events-auto rounded-card border p-3.5 pr-2.5 shadow-glow backdrop-blur-md flex items-start gap-2.5 ${
              toast.type === "error"
                ? "border-danger/30 bg-[#1a0d10]/95 text-danger"
                : "border-success/30 bg-[#0d1a13]/95 text-success"
            }`}
          >
            {toast.type === "error" ? (
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
            )}
            <p className="text-xs font-medium leading-snug flex-1 text-text-primary">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 text-text-soft hover:text-text-primary hover:bg-white/5 transition-colors flex-shrink-0 cursor-pointer"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
