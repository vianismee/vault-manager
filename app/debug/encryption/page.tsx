"use client";

import { useState } from "react";
import { encrypt, decrypt } from "@/lib/encryption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function DebugEncryptionPage() {
  const [testInput, setTestInput] = useState("TestPassword123!");
  const [encrypted, setEncrypted] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [dbEncrypted, setDbEncrypted] = useState("U2FsdGVkX1/w0/F6T6Pom9Aglm93mtC/iBVayazMExQ=");
  const [dbDecrypted, setDbDecrypted] = useState("");

  const handleTestEncrypt = () => {
    const result = encrypt(testInput);
    setEncrypted(result);
    setDecrypted(decrypt(result));
  };

  const handleTestDbDecrypt = () => {
    const result = decrypt(dbEncrypted);
    setDbDecrypted(result);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-display">Encryption Debug</h1>

        {/* Environment Check */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h2 className="font-medium">Environment</h2>
          <div className="text-sm font-mono bg-muted p-2 rounded">
            NEXT_PUBLIC_ENCRYPTION_KEY: {process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "NOT SET (using fallback)"}
          </div>
        </div>

        {/* Test Encryption */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="font-medium">Test Encryption/Decryption</h2>
          <Input
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Enter text to encrypt"
          />
          <Button onClick={handleTestEncrypt}>Test Encrypt</Button>
          {encrypted && (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Encrypted:</span>
                <div className="font-mono text-xs bg-muted p-2 rounded break-all mt-1">{encrypted}</div>
              </div>
              <div className="text-sm">
                <span className="font-medium">Decrypted:</span>
                <div className="font-mono text-xs bg-muted p-2 rounded mt-1">{decrypted}</div>
              </div>
              <div className={`text-sm ${decrypted === testInput ? "text-success" : "text-destructive"}`}>
                {decrypted === testInput ? "✓ Encryption/Decryption working!" : "✗ Failed"}
              </div>
            </div>
          )}
        </div>

        {/* Test DB Password */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="font-medium">Test Database Password</h2>
          <p className="text-sm text-muted-foreground">Paste an encrypted password from the database</p>
          <Input
            value={dbEncrypted}
            onChange={(e) => setDbEncrypted(e.target.value)}
            placeholder="Encrypted password from DB"
            className="font-mono text-xs"
          />
          <Button onClick={handleTestDbDecrypt}>Decrypt DB Password</Button>
          {dbDecrypted && (
            <div className="text-sm">
              <span className="font-medium">Decrypted:</span>
              <div className="font-mono text-sm bg-muted p-2 rounded mt-1">{dbDecrypted}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
