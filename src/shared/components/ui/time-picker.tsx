"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronDown } from "lucide-react";

interface TimePickerProps {
  value: string; // "HH:MM" 24h format
  onChange: (val: string) => void;
  onBlur?: () => void;
  className?: string;
}

export function TimePicker({ value, onChange, onBlur, className = "w-[120px]" }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse 24-hour value string (e.g., "16:00" -> hour12=4, min=0, meridiem="PM")
  const [rawHour, rawMin] = (value || "00:00").split(":");
  const hour24 = parseInt(rawHour || "0", 10);
  const minutesVal = parseInt(rawMin || "0", 10);

  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  const hoursList = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutesList = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10... 55

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          if (onBlur) onBlur();
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onBlur]);

  const handleSelect = (newHour12: number, newMinutes: number, newMeridiem: "AM" | "PM") => {
    let hour24Out = newHour12;
    if (newMeridiem === "PM" && hour24Out !== 12) hour24Out += 12;
    if (newMeridiem === "AM" && hour24Out === 12) hour24Out = 0;

    const hourStr = String(hour24Out).padStart(2, "0");
    const minStr = String(newMinutes).padStart(2, "0");
    onChange(`${hourStr}:${minStr}`);
  };

  const displayTime = () => {
    const formattedHour = String(hour12).padStart(2, "0");
    const formattedMin = String(minutesVal).padStart(2, "0");
    return `${formattedHour}:${formattedMin} ${meridiem}`;
  };

  return (
    <div className={`relative select-none ${isOpen ? "z-[100]" : "z-10"} ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-1.5 rounded-input border border-border px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-all duration-200 cursor-pointer dark:bg-[#12192d] dark:hover:bg-[#1c263f] dark:border-white/10"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock size={13} className="text-text-soft flex-shrink-0" />
          <span className="text-xs font-bold font-mono tracking-wide text-text-primary truncate">
            {displayTime()}
          </span>
        </div>
        <ChevronDown size={12} className="text-text-soft flex-shrink-0" />
      </button>

      {/* Styled Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute mt-2 z-[100] flex gap-2.5 p-2.5 rounded-[18px] border border-white/10 bg-[#0f1526]/98 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-[16px] left-0"
          >
            {/* Hours Column */}
            <div className="flex flex-col gap-0.5 h-[150px] overflow-y-auto pr-1 select-none scrollbar-thin dark:scrollbar-track-transparent">
              <span className="text-[9px] font-bold text-text-soft uppercase tracking-wider text-center mb-1">HH</span>
              {hoursList.map((h) => {
                const isSelected = h === hour12;
                return (
                  <button
                    key={`h-${h}`}
                    type="button"
                    onClick={() => handleSelect(h, minutesVal, meridiem)}
                    className={`px-2 py-1 text-xs font-bold font-mono rounded-[8px] cursor-pointer text-center ${
                      isSelected
                        ? "bg-accent-purple/20 text-accent-purple ring-1 ring-accent-purple/35"
                        : "text-text-muted hover:text-text-primary hover:bg-white/8"
                    }`}
                  >
                    {String(h).padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="w-[1px] bg-white/5 my-1" />

            {/* Minutes Column */}
            <div className="flex flex-col gap-0.5 h-[150px] overflow-y-auto pr-1 select-none scrollbar-thin dark:scrollbar-track-transparent">
              <span className="text-[9px] font-bold text-text-soft uppercase tracking-wider text-center mb-1">MM</span>
              {minutesList.map((m) => {
                const isSelected = m === minutesVal;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    onClick={() => handleSelect(hour12, m, meridiem)}
                    className={`px-2 py-1 text-xs font-bold font-mono rounded-[8px] cursor-pointer text-center ${
                      isSelected
                        ? "bg-accent-cyan/20 text-accent-cyan ring-1 ring-accent-cyan/35"
                        : "text-text-muted hover:text-text-primary hover:bg-white/8"
                    }`}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="w-[1px] bg-white/5 my-1" />

            {/* AM/PM Column */}
            <div className="flex flex-col gap-1 select-none justify-center">
              <span className="text-[9px] font-bold text-text-soft uppercase tracking-wider text-center mb-1">AM/PM</span>
              {["AM", "PM"].map((ampm) => {
                const isSelected = ampm === meridiem;
                return (
                  <button
                    key={`meridiem-${ampm}`}
                    type="button"
                    onClick={() => handleSelect(hour12, minutesVal, ampm as "AM" | "PM")}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-[8px] cursor-pointer text-center ${
                      isSelected
                        ? "bg-accent-purple/20 text-accent-purple ring-1 ring-accent-purple/35"
                        : "text-text-muted hover:text-text-primary hover:bg-white/8"
                    }`}
                  >
                    {ampm}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
