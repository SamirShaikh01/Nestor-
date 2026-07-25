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
