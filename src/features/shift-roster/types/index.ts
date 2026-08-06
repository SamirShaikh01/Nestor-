export type ShiftCodeType = "S1" | "S2" | "G" | "E" | "N" | "WO" | "L" | string;

export interface ShiftPreset {
  code: string;           // e.g. "S1", "G", "E", "N", "WO", "L"
  name: string;           // e.g. "Shift 1", "General Shift", "Night Shift", "Weekly Off"
  timeRange: string;      // e.g. "07:00 AM to 04:00 PM"
  bgHex: string;          // Card background color
  textHex: string;        // Text / Border color
  isOffOrLeave?: boolean;
}

export interface RosterMember {
  employeeId: string;     // e.g. "3894"
  name: string;           // e.g. "Samir Shaikh"
  role?: string;          // e.g. "MSS Engineer"
  department?: string;    // e.g. "MSS Team"
}

export interface RosterAssignment {
  employeeId: string;
  date: string;           // YYYY-MM-DD
  shiftCode: string;      // e.g. "S1", "G", "E", "N", "WO", "L"
  notes?: string;
}
