"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, FileJson, FileSpreadsheet, Chrome, KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import {
  importCredentials,
  importFromFile,
  detectImportFormat,
  type ImportedCredential,
  type ImportResult,
} from "@/lib/importers/import-parser";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [source, setSource] = useState<"chrome" | "lastpass" | "bitwarden" | "vault" | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("upload");
        setSource(null);
        setFileContent(null);
        setFileName("");
        setPreview(null);
        setImportResult(null);
      }, 300);
    }
  }, [open]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const content = await file.text();
      setFileContent(content);

      // Detect format and parse
      const format = detectImportFormat(content);

      if (format === "unknown") {
        toast.error("Unknown file format");
        return;
      }

      // Try each parser
      let result: ImportResult = { success: false, credentials: [], errors: [] };

      if (source === "chrome") {
        result = await importFromFile(content, "chrome");
      } else if (source === "lastpass") {
        result = await importFromFile(content, "lastpass");
      } else if (source === "bitwarden") {
        result = await importFromFile(content, "bitwarden");
      } else if (source === "vault") {
        result = await importFromFile(content, "vault");
      }

      if (result.success && result.credentials.length > 0) {
        setPreview(result);
        setStep("preview");
      } else {
        toast.error("No passwords found in file");
      }
    } catch (error) {
      toast.error("Failed to read file");
    }
  };

  const handleImport = async () => {
    if (!preview?.credentials) return;

    setImporting(true);
    setStep("importing");

    try {
      const result = await importCredentials(preview.credentials);
      setImportResult(result);
      setStep("done");

      if (result.success > 0) {
        toast.success(`Imported ${result.success} passwords`);
        onImportComplete?.();
      }

      if (result.failed > 0) {
        toast.error(`${result.failed} passwords failed to import`);
      }
    } catch (error) {
      toast.error("Import failed");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setSource(null);
    setFileContent(null);
    setFileName("");
    setPreview(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "upload" && (
          <>
            <DialogHeader>
              <DialogTitle>Import Passwords</DialogTitle>
              <DialogDescription>
                Import passwords from another password manager
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-4">
              <ImportSourceOption
                icon={<Chrome className="h-5 w-5" />}
                title="Chrome / Edge"
                description="Export from Password settings"
                selected={source === "chrome"}
                onClick={() => {
                  setSource("chrome");
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
              />
              <ImportSourceOption
                icon={<KeyRound className="h-5 w-5" />}
                title="LastPass"
                description="Export CSV from vault"
                selected={source === "lastpass"}
                onClick={() => {
                  setSource("lastpass");
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
              />
              <ImportSourceOption
                icon={<FileJson className="h-5 w-5" />}
                title="Bitwarden / 1Password"
                description="JSON export format"
                selected={source === "bitwarden"}
                onClick={() => {
                  setSource("bitwarden");
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
              />
              <ImportSourceOption
                icon={<KeyRound className="h-5 w-5" />}
                title="Vault Backup"
                description="Import from Vault export"
                selected={source === "vault"}
                onClick={() => {
                  setSource("vault");
                  setTimeout(() => fileInputRef.current?.click(), 100);
                }}
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}

        {step === "preview" && preview && (
          <>
            <DialogHeader>
              <DialogTitle>Review Import</DialogTitle>
              <DialogDescription>
                {preview.credentials.length} passwords ready to import
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 max-h-64 overflow-y-auto space-y-2">
              {preview.credentials.slice(0, 10).map((cred, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cred.title}</div>
                    <div className="text-muted-foreground text-xs truncate">{cred.username}</div>
                  </div>
                </div>
              ))}
              {preview.credentials.length > 10 && (
                <div className="text-center text-xs text-muted-foreground pt-2">
                  And {preview.credentials.length - 10} more...
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-4">
                  <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {preview.errors.length} error(s)
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {preview.errors.slice(0, 3).map((error, i) => (
                      <div key={i}>• {error}</div>
                    ))}
                    {preview.errors.length > 3 && (
                      <div>• And {preview.errors.length - 3} more...</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import {preview.credentials.length} passwords
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "importing" && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-medium mb-2">Importing passwords...</h3>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-display mb-2">Import Complete</h3>
            <p className="text-muted-foreground mb-6">
              {importResult.success} passwords imported
              {importResult.failed > 0 && ` (${importResult.failed} failed)`}
            </p>
            <DialogFooter className="justify-center">
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImportSourceOption({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      }`}
    >
      <div className={`p-2 rounded-lg ${selected ? "bg-primary/20 text-primary" : "bg-muted"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Upload className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}
