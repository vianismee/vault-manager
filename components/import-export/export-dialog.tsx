"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadVaultJSON, downloadVaultCSV } from "@/lib/exporters/export-vault";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

  const handleExport = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      const success = format === "json"
        ? await downloadVaultJSON()
        : await downloadVaultCSV();

      if (success) {
        toast.success(`Exported as ${format.toUpperCase()}`);
        onOpenChange(false);
      } else {
        toast.error("Export failed");
      }
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Passwords</DialogTitle>
          <DialogDescription>
            Export your encrypted passwords to a file. Keep this file secure!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <ExportOption
            icon={<FileJson className="h-6 w-6" />}
            title="JSON Format (Recommended)"
            description="Encrypted backup file. Can be re-imported to Vault."
            loading={exporting === "json"}
            onClick={() => handleExport("json")}
          />
          <ExportOption
            icon={<FileSpreadsheet className="h-6 w-6" />}
            title="CSV Format"
            description="Spreadsheet-compatible. Passwords remain encrypted."
            loading={exporting === "csv"}
            onClick={() => handleExport("csv")}
          />
        </div>

        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-xs text-destructive">
            <strong>Warning:</strong> Exported files contain sensitive data. Store them securely and delete after use.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportOption({
  icon,
  title,
  description,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-start gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
    >
      <div className="text-primary mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="font-medium mb-0.5">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Download className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  );
}
