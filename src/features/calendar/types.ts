export interface ShiftType {
  name: string;
  timeRange: string;
}

export interface ShiftAssignment {
  shiftName: string;
  inTime: string;  // e.g. "07:00"
  outTime: string; // e.g. "16:00"
  note: string;
}
