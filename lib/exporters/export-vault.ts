/**
 * Export Vault Data
 *
 * Exports user's credentials in various formats (JSON, CSV)
 * All data remains encrypted in the export
 */

import { supabase } from "@/lib/supabase";

export interface CredentialExport {
  title: string;
  username: string | null;
  passwordEncrypted: string;
  url: string | null;
  totpSecret: string | null;
  notes: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultExport {
  version: string;
  exportDate: string;
  itemCount: number;
  credentials: CredentialExport[];
}

/**
 * Fetch all credentials for export
 */
async function fetchCredentials(): Promise<CredentialExport[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("passwords")
    .select("*")
    .eq("user_id", user.id)
    .order("title", { ascending: true });

  if (error) throw error;

  return (data || []).map((cred: any) => ({
    title: cred.title,
    username: cred.username,
    passwordEncrypted: cred.encrypted_password,
    url: cred.url,
    totpSecret: cred.totp_secret,
    notes: cred.notes,
    category: cred.category_id,
    createdAt: cred.created_at,
    updatedAt: cred.updated_at,
  }));
}

/**
 * Export vault as JSON (encrypted format)
 */
export async function exportAsJSON(): Promise<string> {
  const credentials = await fetchCredentials();

  const exportData: VaultExport = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    itemCount: credentials.length,
    credentials,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export vault as CSV (encrypted passwords)
 */
export async function exportAsCSV(): Promise<string> {
  const credentials = await fetchCredentials();

  const headers = ["Title", "Username", "Password (Encrypted)", "URL", "Notes", "Category", "2FA Secret (Encrypted)"];
  const rows = credentials.map((cred) => [
    escapeCSV(cred.title),
    escapeCSV(cred.username || ""),
    escapeCSV(cred.passwordEncrypted),
    escapeCSV(cred.url || ""),
    escapeCSV(cred.notes || ""),
    escapeCSV(cred.category || ""),
    escapeCSV(cred.totpSecret || ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Escape CSV values
 */
function escapeCSV(value: string): string {
  if (!value) return '""';
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger file download
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download vault as JSON
 */
export async function downloadVaultJSON() {
  try {
    const json = await exportAsJSON();
    const date = new Date().toISOString().split("T")[0];
    downloadFile(json, `vault-backup-${date}.json`, "application/json");
    return true;
  } catch (error) {
    console.error("Export failed:", error);
    return false;
  }
}

/**
 * Export and download vault as CSV
 */
export async function downloadVaultCSV() {
  try {
    const csv = await exportAsCSV();
    const date = new Date().toISOString().split("T")[0];
    downloadFile(csv, `vault-export-${date}.csv`, "text/csv");
    return true;
  } catch (error) {
    console.error("Export failed:", error);
    return false;
  }
}
