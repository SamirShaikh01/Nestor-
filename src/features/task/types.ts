export type TaskStatus = "pending" | "in-progress" | "completed";

export type TaskCategory =
  | "Learning"
  | "Meeting"
  | "Operations"
  | "Personal"
  | "Research"
  | "Documentation"
  | "Automation"
  | "Health Check"
  | "Custom";

export interface Task {
  id: number;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  durationMinutes: number;
  tags: string[];
  date: string;
  notes: string;
  sessions: string[];
}
