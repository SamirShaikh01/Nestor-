"use client";

// AES-256-GCM encryption for Password Vault credential data, keyed by a
// user-supplied passphrase via PBKDF2. Runs entirely client-side (Web Crypto
// API) — Supabase only ever stores ciphertext, never plaintext credentials.
//
// Envelope shape stored in the DB's `fields` JSONB column:
//   { __enc: 1, iv: base64, data: base64 }
// `data` decrypts to JSON.stringify({ fields: VaultField[], notes: string }).

const PBKDF2_ITERATIONS = 210_000; // OWASP-recommended baseline for PBKDF2-SHA256
const AES_KEY_LENGTH = 256;

export interface EncryptedEnvelope {
  __enc: 1;
  iv: string;
  data: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function scopeSalt(scope: string): Promise<Uint8Array> {
  // Non-secret, deterministic per-scope salt (domain separation between the
  // team vault key and each user's personal vault key derived from the same
  // underlying passphrase input path).
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nestor-vault:${scope}`));
  return new Uint8Array(digest);
}

export async function deriveVaultKey(passphrase: string, scope: string): Promise<CryptoKey> {
  const salt = await scopeSalt(scope);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVaultPayload(key: CryptoKey, payload: unknown): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    __enc: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVaultPayload<T = unknown>(key: CryptoKey, envelope: EncryptedEnvelope): Promise<T> {
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export function isEncryptedEnvelope(raw: unknown): raw is EncryptedEnvelope {
  return (
    !!raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    (raw as any).__enc === 1 &&
    typeof (raw as any).iv === "string" &&
    typeof (raw as any).data === "string"
  );
}

// ----------------------------------------------------------------------------
// Recovery Kit support: a random Data Encryption Key (DEK) actually encrypts
// vault entries, and is itself "wrapped" (encrypted) under two independent
// keys — one derived from the passphrase, one derived from a one-time
// recovery code. This lets a forgotten passphrase be recovered via the code
// (by unwrapping the DEK and re-wrapping it under a new passphrase) WITHOUT
// touching or re-encrypting a single vault entry, since the DEK never
// changes. Losing both the passphrase and the recovery code is still
// unrecoverable by design (zero-knowledge encryption has no other option).
// ----------------------------------------------------------------------------

export async function generateDataEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: AES_KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

async function exportKeyBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

async function importKeyBase64(b64: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(b64);
  return crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

/** Encrypts (wraps) a DEK under another key, e.g. one derived from a passphrase or recovery code. */
export async function wrapDataEncryptionKey(wrappingKey: CryptoKey, dek: CryptoKey): Promise<EncryptedEnvelope> {
  const rawB64 = await exportKeyBase64(dek);
  return encryptVaultPayload(wrappingKey, rawB64);
}

/** Decrypts (unwraps) a DEK previously wrapped with wrapDataEncryptionKey. */
export async function unwrapDataEncryptionKey(wrappingKey: CryptoKey, envelope: EncryptedEnvelope): Promise<CryptoKey> {
  const rawB64 = await decryptVaultPayload<string>(wrappingKey, envelope);
  return importKeyBase64(rawB64);
}

// Crockford-style alphabet with ambiguous characters (0/O, 1/I/L) removed —
// safe to hand-transcribe from a screen onto paper.
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generates a high-entropy, human-transcribable recovery code, e.g. "XPQ7-K3MN-9RTZ-4HGD-VC2F-8WYB". */
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 6; g++) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    let group = "";
    for (const b of bytes) {
      group += RECOVERY_CODE_ALPHABET[b % RECOVERY_CODE_ALPHABET.length];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Normalizes user-entered recovery codes (case/whitespace) before deriving a key from them. */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
