export type TicketStatus =
  | "Open"
  | "In Progress"
  | "Awaiting Information"
  | "Closed"
  | "On Hold"
  | "Resolved";

export type TicketPriority = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export interface TicketComment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

/** A single user's work entry on a shared ticket */
export interface TicketWorkLog {
  id: number;
  ticketId: string;
  userId: string;
  authorName: string;
  date: string;      // YYYY-MM-DD
  myWork: string;
  myNote?: string;
  createdAt: string;
}

export interface Ticket {
  id: string; // INC-XXXXX format
  customerId: string;
  customerName: string;
  subject: string;
  details: string;
  priority: TicketPriority;
  status: TicketStatus;
  product: string;
  raisedBy: string;
  date: string; // YYYY-MM-DD
  myWork: string; // Latest work summary (local fallback)
  myNote?: string; // Latest note (local fallback)
  comments: TicketComment[];
  createdAt?: string;
  workLogs?: TicketWorkLog[]; // All per-user work log entries
}

