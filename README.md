# Nestor

Nestor is a premium, high-performance internal operations and workforce management platform. Designed with a focus on deep aesthetics, modern user experience, and robust modularity, Nestor centralizes Shift Rostering, Task Management, and Ticketing into a single, unified workspace.

## Core Features

- **Shift Roster**: A comprehensive matrix for assigning, tracking, and publishing employee shifts. Features visual analytics, real-time availability tracking, and conflict management.
- **Task Management**: A robust board for tracking daily deliverables, featuring rich descriptions, priority levels, status updates, and interactive edit forms.
- **Ticketing System**: Internal helpdesk operations allowing users to raise, track, and resolve IT or operational tickets with ease.
- **Role-Based Access Control**: Intelligent UI that adapts based on user privileges (Admin vs. Standard User), restricting destructive actions and sensitive information.

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router) with Turbopack for ultra-fast compilation.
- **Language**: TypeScript for end-to-end type safety.
- **Styling**: Tailwind CSS configured for a bespoke dark-themed design system.
- **Animations**: Framer Motion for micro-interactions, layout transitions, and fluid UI elements.
- **Icons**: Lucide React.

### Backend & Database
- **Database**: PostgreSQL hosted on Supabase.
- **Data Fetching**: Supabase JS Client for real-time synchronization and querying.
- **State Management**: React Context API (`useNestor`) for global state, reducing prop drilling and centralizing complex data logic.

## Getting Started

1. Clone the repository and navigate to the project root.
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Set up environment variables for Supabase in a \`.env.local\` file:
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   \`\`\`
4. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Documentation Index

Explore the core structural pillars of Nestor through the dedicated documentation files:
- [Architecture](./ARCHITECTURE.md) - High-level system design and component structure.
- [Design](./DESIGN.md) - The philosophy and implementation of Nestor's premium UI.
- [Database](./DATABASE.md) - Supabase schema and data relationships.
- [Authentication](./AUTH.md) - Role-based access control and session management.
