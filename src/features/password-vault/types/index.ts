export interface VaultField {
  id: string;
  key: string;       // e.g. "Username", "Server IP", "VPN Port", "Password", "Domain"
  value: string;     // actual credential value
  isSecret: boolean; // if true -> masked with show/hide toggle
}

export interface VaultEntry {
  id: string;
  label: string;     // e.g. "VPN Creds", "Server Creds", "Database Server"
  fields: VaultField[];
  notes?: string;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultClientSection {
  id: string;
  clientId: string;    // e.g. "4130"
  clientName: string;  // e.g. "SIDBI"
  entries: VaultEntry[];
}

export interface VaultProductGroup {
  id: string;
  category: string;    // e.g. "AV", "EDR", "PAM", "DLP"
  productName: string; // e.g. "Trellix AV", "CrowdStrike XDR", "CyberArk PAM"
  clients: VaultClientSection[];
}

export interface PersonalVaultEntry {
  id: string;
  username: string;    // user who owns this personal entry
  label: string;
  fields: VaultField[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type VaultChangeRequestStatus = "pending" | "approved" | "rejected";

/** A member's proposed new value for one field of a Team Vault credential set, pending admin review. */
export interface VaultChangeRequest {
  id: number;
  userId: string;
  requesterName: string;
  entryId: string;     // VaultEntry.id this request targets
  fieldId: string;     // VaultField.id within that entry
  newValue: string;    // decrypted client-side; encrypted under the Team Vault key at rest
  secureUrl?: string;  // optional secure link (e.g. a password-manager share link) in place of/alongside newValue
  reason: string;
  status: VaultChangeRequestStatus;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}
