export interface OemCase {
  id: string;
  productName: string;
  productCategory: string;
  clientId: string;
  clientName: string;
  caseType: string; // e.g. Feature Request, Hash Blocking, Issue, Service Request, Other
  oemCaseId: string; // e.g. TR-99824
  internalTicketId: string; // e.g. INC-23911
  title: string;
  description: string;
  priority: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  assignedTo: string;
  raisedBy: string;
  createdDate: string; // YYYY-MM-DD
  updatedDate: string; // YYYY-MM-DD
  statusUpdate: string; // e.g. Pending From OEM, Pending Customer, Issue Resolved, Escalated
  closureDate?: string | null; // YYYY-MM-DD
  agingDays?: number; // Calculated dynamically
  notes: string;
}
