"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Copy, Check, Loader2, AlertCircle, Wand2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/src/shared/lib/supabase";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
  { value: "concise", label: "Concise" },
  { value: "friendly", label: "Friendly" },
];

export function EmailReframerModule() {
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState("professional");
  const [reframed, setReframed] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleReframe = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setErrorMsg("");
    setReframed("");

    try {
      if (!isSupabaseConfigured || !supabase) {
        setErrorMsg("This feature requires Supabase to be configured.");
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setErrorMsg("Your session has expired — please sign in again.");
        return;
      }

      const res = await fetch("/api/ai/reframe-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ draft: trimmed, tone }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong — please try again.");
        return;
      }
      setReframed(data.reframed);
    } catch (err) {
      setErrorMsg("Couldn't reach the server — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!reframed) return;
    await navigator.clipboard.writeText(reframed);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-3 rounded-card border p-5 shadow-soft dark:border-white/5 dark:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-[14px] bg-gradient-to-br from-accent-purple/15 to-accent-cyan/15 p-2.5 text-accent-purple flex-shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-soft">AI Tools</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Email Reframer</h2>
          </div>
        </div>
        <p className="text-xs text-text-soft max-w-2xl">
          Paste a draft email below and get a clearer, more professional rewrite. Nothing you paste
          here is saved — this is a one-off tool, not a history.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div className="rounded-card border p-5 shadow-soft dark:border-white/5 dark:bg-card-bg space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">Your Draft</label>
            <div className="flex items-center gap-1.5">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`rounded-pill px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    tone === t.value
                      ? "bg-gradient-to-r from-accent-purple to-accent-cyan text-white shadow-glow"
                      : "text-text-soft hover:text-text-primary hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste or write your email draft here…"
            rows={14}
            maxLength={6000}
            className="w-full rounded-input border px-3.5 py-3 text-sm text-text-primary outline-none focus:border-accent-cyan transition-colors border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">{draft.length} / 6000</span>
            <button
              type="button"
              onClick={handleReframe}
              disabled={isLoading || !draft.trim()}
              className="flex items-center gap-1.5 rounded-btn bg-gradient-to-r from-accent-purple to-accent-cyan px-5 py-2.5 text-xs font-bold text-white shadow-glow hover:scale-105 transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {isLoading ? "Reframing…" : "Reframe"}
            </button>
          </div>
          {errorMsg && (
            <p className="text-xs text-danger flex items-start gap-1.5">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {errorMsg}
            </p>
          )}
        </div>

        {/* Output */}
        <div className="rounded-card border p-5 shadow-soft dark:border-white/5 dark:bg-card-bg space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-text-soft">Reframed Result</label>
            {reframed && (
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent-cyan hover:underline cursor-pointer"
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                {isCopied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <div className="flex-1 rounded-input border px-3.5 py-3 text-sm border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 min-h-[300px] whitespace-pre-wrap">
            {isLoading ? (
              <span className="text-text-muted italic text-xs">Reframing your email…</span>
            ) : reframed ? (
              <span className="text-text-primary">{reframed}</span>
            ) : (
              <span className="text-text-muted italic text-xs">Your rewritten email will appear here.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
