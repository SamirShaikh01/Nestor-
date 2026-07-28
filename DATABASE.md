# Database Architecture

Nestor is powered by a PostgreSQL database hosted on **Supabase**. The database is designed for referential integrity, real-time potential, and scalability.

## Supabase Client Integration

The application interfaces with the database strictly through the \`@supabase/supabase-js\` client, configured in \`src/lib/supabase.ts\`.

## Core Tables

### 1. \`tickets\`
Stores operational and IT support tickets.
- \`id\` (UUID, Primary Key)
- \`ticket_id\` (String, Unique) - The human-readable ID (e.g., 212121).
- \`subject\` (String)
- \`description\` (Text)
- \`status\` (String: 'open', 'in_progress', 'resolved')
- \`priority\` (String)
- \`raised_by\` (String) - Can be an external employee or client.
- \`assigned_to\` (String) - Nestor username.
- \`created_at\` (Timestamptz)

### 2. \`tasks\`
Stores daily workforce deliverables.
- \`id\` (UUID, Primary Key)
- \`title\` (String)
- \`description\` (Text)
- \`status\` (String)
- \`priority\` (String)
- \`assignee\` (String) - Nestor username.
- \`due_date\` (Date)
- \`created_at\` (Timestamptz)

### 3. \`shift_assignments\`
Records the actual assigned shifts for roster members.
- \`id\` (UUID, Primary Key)
- \`employee_id\` (String) - References a roster member.
- \`date_str\` (String: 'YYYY-MM-DD')
- \`shift_code\` (String) - e.g., 'G', 'N', 'M'.
- \`created_at\` (Timestamptz)
- **Constraint**: Unique constraint on \`(employee_id, date_str)\` to prevent duplicate shift assignments per day.

### 4. \`shift_requests\`
Manages requests made by users to change their assigned shifts.
- \`id\` (UUID, Primary Key)
- \`employee_id\` (String)
- \`date_str\` (String)
- \`requested_shift_code\` (String)
- \`reason\` (Text)
- \`status\` (String: 'pending', 'approved', 'rejected')
- \`created_at\` (Timestamptz)

## Row Level Security (RLS)
While Nestor currently handles logic in the application layer via Context, Supabase RLS policies can be applied to restrict users from modifying records they do not own, adding a secondary layer of backend security alongside the frontend role checks.
