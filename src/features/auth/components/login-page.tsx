"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { KeyRound, Mail, Lock, User, AlertCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/src/shared/lib/supabase";
import { useNestor } from "@/src/shared/context/nestor-context";

// Dev-only quick-login shortcuts — never rendered in a production build.
// See docs/decisions.md ADR-019 before adding more of these or changing the
// gating condition.
const DEV_QUICK_LOGINS =
  process.env.NODE_ENV !== "production"
    ? [
        { label: "Member 1", role: "Member", email: "m1@gmail.com", password: "123456" },
        { label: "Member 2", role: "Member", email: "m2@gmail.com", password: "966230" },
        { label: "Admin", role: "Admin", email: "shaikh1@gmail.com", password: "966230" },
      ]
    : [];

export function LoginPage() {
  const { authNotice, setAuthNotice } = useNestor();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Surface a forced-sign-out reason (e.g. an admin disabled this account)
  // once, then clear it from context so it doesn't reappear later.
  useEffect(() => {
    if (authNotice) {
      setErrorMsg(authNotice);
      setAuthNotice(null);
    }
  }, [authNotice, setAuthNotice]);

  const performSignIn = async (emailVal: string, passwordVal: string) => {
    if (!emailVal || !passwordVal) return;
    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email: emailVal.trim(),
        password: passwordVal,
      });

      if (error) {
        const msg = typeof error.message === 'string' && error.message.trim() !== '' && error.message !== '{}'
          ? error.message
          : "Invalid email or password / Account authentication issue.";
        setErrorMsg(msg);
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSignIn(email, password);
  };

  const handleQuickLogin = (quickEmail: string, quickPassword: string) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    performSignIn(quickEmail, quickPassword);
  };

  const inputCls =
    "w-full rounded-input border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1424]/60 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-cyan focus:bg-white dark:focus:bg-[#111c30] transition-all";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#080d16] relative overflow-hidden select-none">
      {/* Background glowing blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-accent-purple/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-card border shadow-glow border-white/5 bg-[#0f172a]/80 backdrop-blur-md p-8 space-y-6 z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-cyan/10 text-accent-cyan mb-2 shadow-inner">
            <KeyRound size={26} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            NESTOR <span className="text-xs font-mono font-bold bg-accent-cyan/20 text-accent-cyan px-2 py-0.5 rounded">PWIS</span>
          </h1>
          <p className="text-xs text-text-soft">
            Secure sign in to your central operations intelligence portal.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-input bg-danger/10 border border-danger/25 text-xs text-danger flex items-start gap-2">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-input bg-accent-cyan/10 border border-accent-cyan/25 text-xs text-accent-cyan flex items-start gap-2">
            <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className={inputCls}
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-soft" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan py-3 text-sm font-bold text-white shadow-glow hover:scale-[1.02] transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </motion.div>

      {DEV_QUICK_LOGINS.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full max-w-md rounded-card border border-dashed border-amber-500/30 bg-amber-500/[0.03] p-4 mt-4 z-10 space-y-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 text-center">
            Dev Quick Login (not shown in production)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEV_QUICK_LOGINS.map((u) => (
              <button
                key={u.email}
                type="button"
                disabled={loading}
                onClick={() => handleQuickLogin(u.email, u.password)}
                className="rounded-input border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-500/40 transition-all py-2 px-1 text-center cursor-pointer disabled:opacity-50"
                title={`${u.email}`}
              >
                <span className="block text-xs font-bold text-white">{u.label}</span>
                <span className="block text-[9px] text-text-soft">{u.role}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
