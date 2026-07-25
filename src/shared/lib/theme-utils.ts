/**
 * Returns Tailwind CSS class names for a given task category badge.
 * Distinct, vibrant colors per category — works in both light and dark modes.
 */
export function getCategoryColorBadge(category: string): string {
  switch (category?.trim()) {
    case "Meeting":
      return "bg-sky-500/15 text-sky-300 border border-sky-500/25";
    case "Learning":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25";
    case "Research":
      return "bg-violet-500/15 text-violet-300 border border-violet-500/25";
    case "Documentation":
      return "bg-slate-500/15 text-slate-400 border border-slate-500/25";
    case "Operations":
      return "bg-orange-500/15 text-orange-300 border border-orange-500/25";
    case "Automation":
      return "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25";
    case "Health Check":
      return "bg-teal-500/15 text-teal-300 border border-teal-500/25";
    case "Personal":
      return "bg-pink-500/15 text-pink-300 border border-pink-500/25";
    default:
      return "bg-purple-500/15 text-purple-300 border border-purple-500/25";
  }
}

/**
 * Returns category icon background + text color for an icon badge wrapper.
 */
export function getCategoryIconColor(category: string): string {
  switch (category?.trim()) {
    case "Meeting":
      return "bg-sky-500/15 text-sky-400";
    case "Learning":
      return "bg-emerald-500/15 text-emerald-400";
    case "Research":
      return "bg-violet-500/15 text-violet-400";
    case "Documentation":
      return "bg-slate-500/15 text-slate-400";
    case "Operations":
      return "bg-orange-500/15 text-orange-400";
    case "Automation":
      return "bg-cyan-500/15 text-cyan-400";
    case "Health Check":
      return "bg-teal-500/15 text-teal-400";
    case "Personal":
      return "bg-pink-500/15 text-pink-400";
    default:
      return "bg-purple-500/15 text-purple-400";
  }
}

/**
 * Returns Tailwind CSS class names for a given shift type calendar pill.
 * Each shift gets a distinct, vibrant color.
 */
export function getShiftBadgeClasses(shiftName: string): string {
  switch (shiftName?.trim()) {
    case "Leave":
      return "bg-red-500/15 text-red-300 border border-red-500/25";
    case "Week Off":
      return "bg-slate-500/15 text-slate-400 border border-slate-500/25";
    case "Morning Shift":
      return "bg-amber-500/15 text-amber-300 border border-amber-500/25";
    case "General Shift":
      return "bg-blue-500/15 text-blue-300 border border-blue-500/25";
    case "Evening Shift":
      return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25";
    case "Night Shift":
      return "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25";
    default:
      return "bg-purple-500/15 text-purple-300 border border-purple-500/25";
  }
}

/**
 * Returns a hex color for a shift (for legend dots and SVG/canvas elements).
 */
export function getShiftHexColor(shiftName: string): string {
  switch (shiftName?.trim()) {
    case "General Shift": return "#3b82f6";
    case "Morning Shift": return "#f59e0b";
    case "Evening Shift": return "#10b981";
    case "Night Shift":   return "#6366f1";
    case "Week Off":      return "#94a3b8";
    case "Leave":         return "#ef4444";
    default:              return "#a855f7";
  }
}
