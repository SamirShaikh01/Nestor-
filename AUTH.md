# Authentication & Authorization

Nestor utilizes a streamlined, fast-access authentication protocol designed for internal teams, coupled with a robust Role-Based Access Control (RBAC) system.

## Authentication Flow

1. **Login Interface**: The user is presented with a sleek, minimalist login screen utilizing the \`app/login/page.tsx\` route.
2. **Credential Validation**: 
   - Nestor checks the entered credentials against predefined local roles (or a remote auth service, depending on environment configuration).
   - The user selects or is assigned their `username` and `role`.
3. **Session Persistence**: 
   - The active session is securely stored in the browser's \`localStorage\`.
   - On application load, \`nestor-context.tsx\` immediately hydrates the session state, avoiding loading flashes.

## Role-Based Access Control (RBAC)

Nestor divides users into two primary operational tiers:

### 1. **Admins**
- **Capabilities**: Full access to all destructive and managerial actions.
- **UI Exposure**:
  - Can view and interact with the **"Publish Roster"** and **"Unpublish/Cancel"** controls in the Shift Roster.
  - Can add and remove Roster Members.
  - Can approve or reject Shift Change Requests.
  - Can edit and delete Tickets and Tasks globally.

### 2. **Standard Users**
- **Capabilities**: Day-to-day operational work.
- **UI Exposure**:
  - The Shift Roster is **Read-Only** (they cannot publish or bulk-assign).
  - Can view their own assignments and request shift changes.
  - Can create and progress Tickets/Tasks, but cannot delete global system entities indiscriminately.

## Component-Level Authorization

Nestor protects UI elements implicitly by checking the \`role\` string exposed by \`useNestor()\`. 

Example of conditional rendering:
\`\`\`tsx
const { role } = useNestor();

return (
  <div>
    {/* Visible to everyone */}
    <ShiftGrid />
    
    {/* Protected Admin Actions */}
    {role === "admin" && (
      <button onClick={handlePublishRoster}>Publish Changes</button>
    )}
  </div>
);
\`\`\`

By coupling authentication directly into the global context, the frontend remains highly secure against accidental UI exposure while providing a seamless user experience.
