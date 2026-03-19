/**
 * Import Parsers for Password Managers
 *
 * Supports importing from:
 * - Chrome/Edge CSV export
 * - 1Password (1PUX format)
 * - LastPass CSV export
 * - Bitwarden JSON export
 * - Vault JSON export
 */

import { encrypt } from "@/lib/encryption";

export interface ImportedCredential {
  title: string;
  username?: string;
  password: string; // Will be encrypted during import
  url?: string;
  totpSecret?: string;
  notes?: string;
  category?: string;
}

export interface ImportResult {
  success: boolean;
  credentials: ImportedCredential[];
  errors: string[];
}

// ============================================
// Chrome/Edge CSV Parser
// ============================================
export function parseChromeCSV(csvText: string): ImportResult {
  const credentials: ImportedCredential[] = [];
  const errors: string[] = [];

  const lines = csvText.trim().split("\n");
  const headers = lines[0].toLowerCase();

  // Chrome CSV format: name, url, username, password
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);

      if (values.length < 2) {
        errors.push(`Line ${i + 1}: Not enough columns`);
        continue;
      }

      const [name, url, username, password] = values;

      if (!name || !password) {
        errors.push(`Line ${i + 1}: Missing name or password`);
        continue;
      }

      credentials.push({
        title: name,
        username: username || undefined,
        password: password,
        url: url || undefined,
      });
    } catch (e) {
      errors.push(`Line ${i + 1}: Failed to parse`);
    }
  }

  return { success: credentials.length > 0, credentials, errors };
}

// ============================================
// LastPass CSV Parser
// ============================================
export function parseLastPassCSV(csvText: string): ImportResult {
  const credentials: ImportedCredential[] = [];
  const errors: string[] = [];

  const lines = csvText.trim().split("\n");

  // LastPass CSV: url, username, password, extra, name, grouping, fav
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);

      if (values.length < 4) {
        errors.push(`Line ${i + 1}: Not enough columns`);
        continue;
      }

      const [url, username, password, extra, name, grouping] = values;

      if (!password) {
        errors.push(`Line ${i + 1}: Missing password`);
        continue;
      }

      credentials.push({
        title: name || url || "Imported Password",
        username: username || undefined,
        password: password,
        url: url || undefined,
        notes: extra || undefined,
        category: grouping || undefined,
      });
    } catch (e) {
      errors.push(`Line ${i + 1}: Failed to parse`);
    }
  }

  return { success: credentials.length > 0, credentials, errors };
}

// ============================================
// Bitwarden JSON Parser
// ============================================
export function parseBitwardenJSON(jsonText: string): ImportResult {
  const credentials: ImportedCredential[] = [];
  const errors: string[] = [];

  try {
    const data = JSON.parse(jsonText);
    const items = data.items || data.ciphers || [];

    for (const item of items) {
      try {
        if (item.type === 1 || item.login) {
          // Login item
          const login = item.login || {};
          const name = item.name || "Imported Password";

          credentials.push({
            title: name,
            username: login.username || undefined,
            password: login.password || "",
            url: login.uris?.[0]?.uri || undefined,
            totpSecret: login.totp || undefined,
            notes: item.notes || undefined,
            category: item.folder || undefined,
          });
        } else if (item.type === 2 || item.card) {
          // Card item - convert to secure note
          const card = item.card || {};
          credentials.push({
            title: item.name || "Card",
            username: `Card: ${card.number || ""}`,
            password: card.code || "",
            notes: `Cardholder: ${card.cardholder || ""}\nExpiry: ${card.expMonth || ""}/${card.expYear || ""}`,
            category: "Financial",
          });
        }
      } catch (e) {
        errors.push(`Item ${item.name || "unknown"}: Failed to parse`);
      }
    }
  } catch (e) {
    errors.push("Failed to parse JSON file");
  }

  return { success: credentials.length > 0, credentials, errors };
}

// ============================================
// Vault JSON Export Parser
// ============================================
export function parseVaultJSON(jsonText: string): ImportResult {
  const credentials: ImportedCredential[] = [];
  const errors: string[] = [];

  try {
    const data = JSON.parse(jsonText);

    // Check if it's a Vault export
    if (!data.version || !data.credentials) {
      errors.push("Not a valid Vault export file");
      return { success: false, credentials: [], errors };
    }

    for (const cred of data.credentials) {
      credentials.push({
        title: cred.title,
        username: cred.username || undefined,
        password: cred.passwordEncrypted, // Already encrypted
        url: cred.url || undefined,
        totpSecret: cred.totpSecret || undefined,
        notes: cred.notes || undefined,
        category: cred.category || undefined,
      });
    }
  } catch (e) {
    errors.push("Failed to parse JSON file");
  }

  return { success: credentials.length > 0, credentials, errors };
}

// ============================================
// Helper: Parse CSV line handling quoted values
// ============================================
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// ============================================
// Import credentials to database
// ============================================
export async function importCredentials(
  credentials: ImportedCredential[],
  categoryId?: string | null
): Promise<{ success: number; failed: number }> {
  const { supabase } = await import("@/lib/supabase");
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  let success = 0;
  let failed = 0;

  for (const cred of credentials) {
    try {
      // Check if password is already encrypted (from Vault export)
      const isEncrypted = cred.password.length > 32 && !cred.password.includes(" ");

      const passwordEncrypted = isEncrypted
        ? cred.password
        : await encrypt(cred.password);

      const { error } = await supabase.from("passwords").insert({
        user_id: user.id,
        title: cred.title,
        username: cred.username || null,
        encrypted_password: passwordEncrypted,
        url: cred.url || null,
        totp_secret: cred.totpSecret || null,
        notes: cred.notes || null,
        category_id: categoryId || null,
      });

      if (error) throw error;
      success++;
    } catch (e) {
      console.error(`Failed to import ${cred.title}:`, e);
      failed++;
    }
  }

  return { success, failed };
}

// ============================================
// Detect import format
// ============================================
export function detectImportFormat(content: string): "json" | "csv" | "unknown" {
  const trimmed = content.trim();

  if (trimmed.startsWith("{")) {
    return "json";
  }

  if (trimmed.includes(",") && trimmed.includes("\n")) {
    return "csv";
  }

  return "unknown";
}

// ============================================
// Universal import function
// ============================================
export async function importFromFile(
  content: string,
  source: "chrome" | "lastpass" | "bitwarden" | "vault"
): Promise<ImportResult> {
  switch (source) {
    case "chrome":
      return parseChromeCSV(content);
    case "lastpass":
      return parseLastPassCSV(content);
    case "bitwarden":
      return parseBitwardenJSON(content);
    case "vault":
      return parseVaultJSON(content);
    default:
      return { success: false, credentials: [], errors: ["Unknown import source"] };
  }
}
