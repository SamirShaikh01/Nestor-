"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  icon?: LucideIcon;
  width?: string;
  uppercase?: boolean;
  align?: "left" | "right";
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select option",
  className = "",
  icon: Icon,
  width = "w-full min-w-[160px]",
  uppercase = true,
  align = "left",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={`relative ${width} select-none`} ref={containerRef}>
      {/* Trigger Button — uses CSS vars so it adapts to .dark / .light automatically */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-2 rounded-input border border-border px-3.5 py-2.5 text-sm font-semibold text-text-primary outline-none transition-all duration-200 cursor-pointer
          dark:bg-[#12192d] dark:hover:bg-[#1c263f] dark:border-white/10
          ${className}`}
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon size={14} className="text-accent-cyan flex-shrink-0" />}
          <span className={`truncate ${uppercase ? "uppercase tracking-wider text-xs font-bold" : ""}`}>
            {displayLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-text-soft flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute mt-2 max-h-[250px] overflow-y-auto rounded-[16px] border p-1.5 z-[100] flex flex-col gap-0.5
              dark:border-white/10 dark:bg-[#12192d] dark:shadow-[0_12px_30px_rgba(0,0,0,0.45)]
              ${align === "right" ? "right-0" : "left-0"} ${width}`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-[10px] transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "bg-accent-cyan/20 text-accent-cyan ring-1 ring-accent-cyan/30"
                      : "text-text-muted hover:text-text-primary dark:hover:bg-white/8"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="text-center text-xs text-text-soft py-4 italic select-none">
                No options available
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
