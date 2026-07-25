/**
 * Centralized color mapping for task categories and shift types.
 * Returns Tailwind-compatible class strings for use in badge, icon, and pill elements.
 */

// --- Category Colors ---

type CategoryColorSet = {
  /** Badge background + text classes */
  badge: string;
  /** Icon wrapper bg + text classes */
  icon: string;
  /** Dot indicator color */
  dot: string;
};

const CATEGORY_COLORS: Record<string, CategoryColorSet> = {
  meeting: {
    badge: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25",
    icon: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  learning: {
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  operations: {
    badge: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/25",
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  personal: {
    badge: "bg-pink-100 text-pink-700 border border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/25",
    icon: "bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400",
    dot: "bg-pink-500",
  },
  research: {
    badge: "bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  documentation: {
    badge: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/25",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
    dot: "bg-slate-500",
  },
  automation: {
    badge: "bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/25",
    icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  "health check": {
    badge: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25",
    icon: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
    dot: "bg-teal-500",
  },
};

const DEFAULT_CATEGORY_COLOR: CategoryColorSet = {
  badge: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25",
  icon: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  dot: "bg-purple-500",
};

/**
 * Get color classes for a task/work category.
 * @param category - category string (case-insensitive)
 * @param type - which style variant to return
 */
export function getCategoryColor(
  category: string,
  type: keyof CategoryColorSet = "badge"
): string {
  const key = category?.toLowerCase().trim() ?? "";
  return (CATEGORY_COLORS[key] ?? DEFAULT_CATEGORY_COLOR)[type];
}

// --- Shift Colors ---

type ShiftColorSet = {
  /** Badge background + text classes */
  badge: string;
  /** Calendar pill classes */
  pill: string;
  /** Dot indicator color */
  dot: string;
  /** Hex dot color for legend */
  hex: string;
};

const SHIFT_COLORS: Record<string, ShiftColorSet> = {
  "morning shift": {
    badge: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  "general shift": {
    badge: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    dot: "bg-blue-500",
    hex: "#3b82f6",
  },
  "evening shift": {
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  "night shift": {
    badge: "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
    pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    dot: "bg-indigo-500",
    hex: "#6366f1",
  },
  "leave": {
    badge: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    dot: "bg-red-500",
    hex: "#ef4444",
  },
  "week off": {
    badge: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/25",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    dot: "bg-slate-400",
    hex: "#94a3b8",
  },
};

const DEFAULT_SHIFT_COLOR: ShiftColorSet = {
  badge: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25",
  pill: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  dot: "bg-purple-500",
  hex: "#a855f7",
};

/**
 * Get color classes for a calendar shift type.
 * @param shiftName - shift name string (case-insensitive)
 * @param type - which style variant to return
 */
export function getShiftColor(
  shiftName: string,
  type: keyof ShiftColorSet = "badge"
): string {
  const key = shiftName?.toLowerCase().trim() ?? "";
  return (SHIFT_COLORS[key] ?? DEFAULT_SHIFT_COLOR)[type];
}

/**
 * Get the hex color for a shift (used in SVG/canvas legend dots).
 */
export function getShiftHex(shiftName: string): string {
  const key = shiftName?.toLowerCase().trim() ?? "";
  return SHIFT_COLORS[key]?.hex ?? DEFAULT_SHIFT_COLOR.hex;
}
