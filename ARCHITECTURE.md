# System Architecture

Nestor is built using a modern, decoupled architecture centered around Next.js App Router, modular feature directories, and a robust global state context.

## High-Level Diagram

\`\`\`mermaid
graph TD;
    Client[Browser/Client] --> NextJS[Next.js App Router];
    NextJS --> FeatureModules[Feature Modules];
    NextJS --> GlobalContext[Nestor Context API];
    FeatureModules --> GlobalContext;
    GlobalContext --> SupabaseClient[Supabase JS Client];
    SupabaseClient --> PostgreSQL[(PostgreSQL Database)];
\`\`\`

## Directory Structure

Nestor follows a feature-driven folder structure inside the \`src\` directory. This approach ensures that components, types, and logic related to a specific domain are kept closely co-located.

\`\`\`text
src/
├── app/                  # Next.js App Router endpoints and page layouts
├── features/             # Domain-specific modules
│   ├── auth/             # Login, roles, and session logic
│   ├── shift-roster/     # Shift tracking, assignments, UI matrices
│   ├── task/             # Task cards, kanban boards, filtering
│   └── ticket/           # Ticketing lists, creation forms
├── shared/               # Reusable components and logic
│   ├── components/       # AppShell, Navigation, generic buttons/inputs
│   └── context/          # nestor-context.tsx (Global State)
└── lib/                  # Utilities, Supabase configuration
\`\`\`

## Global State Management

Nestor utilizes a unified React Context (\`NestorContext\`) rather than Redux or Zustand. This Context acts as the central brain of the application.

### Why Context API?
1. **Simplicity**: No boilerplate overhead compared to external libraries.
2. **Centralized Data Fetching**: The context provider wraps the application and performs initial data fetches from Supabase on mount.
3. **Optimistic Updates**: The context functions (e.g., \`saveRosterChanges\`, \`addTicket\`) immediately update the local React state for a snappy UI, while asynchronously syncing with Supabase in the background.

## The App Shell Pattern

Nestor utilizes an \`AppShell\` layout component that wraps all authenticated pages. The App Shell provides:
- The sticky sidebar navigation for desktop.
- The sticky top mobile navbar.
- Z-index management and layout bounding to ensure the central workspace is always perfectly scrollable.
