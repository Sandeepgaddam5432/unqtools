"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { generateAuthHeader, getAuthSchemes, type AuthScheme } from "./logic";
import { Shield, Key, User, Hash, Copy, Terminal, Code2 } from "lucide-react";

export default function ApiAuthHeaderBuilder() {
  const [scheme, setScheme] = useState<AuthScheme>("bearer");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key");
  const [accessToken, setAccessToken] = useState("");
  const [tokenType, setTokenType] = useState("Bearer");
  const [hmacSecret, setHmacSecret] = useState("");
  const [hmacPayload, setHmacPayload] = useState("");
  const [hmacAlgorithm, setHmacAlgorithm] = useState("SHA-256");
  const [awsAccessKeyId, setAwsAccessKeyId] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsService, setAwsService] = useState("execute-api");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ headerName: string; headerValue: string; curlExample: string; fetchExample: string } | null>(null);

  const schemes = getAuthSchemes();

  const generate = useCallback(async () => {
    setError(null);
    setResult(null);

    const params: Record<string, unknown> = { scheme };

    switch (scheme) {
      case "bearer":
        params.token = token;
        break;
      case "basic":
        params.username = username;
        params.password = password;
        break;
      case "apikey":
        params.apiKey = apiKey;
        params.apiKeyHeader = apiKeyHeader;
        break;
      case "oauth2":
        params.accessToken = accessToken;
        params.tokenType = tokenType;
        break;
      case "hmac":
        params.hmacSecret = hmacSecret;
        params.hmacPayload = hmacPayload;
        params.hmacAlgorithm = hmacAlgorithm;
        break;
      case "aws4":
        params.accessKeyId = awsAccessKeyId;
        params.secretKey = awsSecretKey;
        params.region = awsRegion;
        params.service = awsService;
        break;
    }

    const res = await generateAuthHeader(params as any);
    if (res.ok) {
      setResult(res.result);
      toast.success("Header generated");
    } else {
      setError(res.error);
    }
  }, [scheme, token, username, password, apiKey, apiKeyHeader, accessToken, tokenType, hmacSecret, hmacPayload, hmacAlgorithm, awsAccessKeyId, awsSecretKey, awsRegion, awsService]);

  const clear = useCallback(() => {
    setToken("");
    setUsername("");
    setPassword("");
    setApiKey("");
    setAccessToken("");
    setHmacSecret("");
    setHmacPayload("");
    setAwsAccessKeyId("");
    setAwsSecretKey("");
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Scheme selector */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Auth Scheme
              </Label>
              <Select value={scheme} onValueChange={(v) => setScheme(v as AuthScheme)}>
                <SelectTrigger className="w-56" aria-label="Auth scheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              {schemes.find(s => s.id === scheme)?.description}
            </p>
            <div className="ml-auto flex gap-2">
              <Button onClick={generate} className="gap-1.5">
                <Key className="h-3.5 w-3.5" /> Generate Header
              </Button>
              <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
            </div>
          </div>

          {/* Dynamic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scheme === "bearer" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="token" className="text-xs">Token</Label>
                <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIs..." className="font-mono text-sm" />
              </div>
            )}

            {scheme === "basic" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username" className="text-xs flex items-center gap-1">
                    <User className="h-3 w-3" /> Username
                  </Label>
                  <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </>
            )}

            {scheme === "apikey" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apiKeyHeader" className="text-xs">Header Name</Label>
                  <Input id="apiKeyHeader" value={apiKeyHeader} onChange={(e) => setApiKeyHeader(e.target.value)} placeholder="X-API-Key" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="apiKey" className="text-xs flex items-center gap-1">
                    <Hash className="h-3 w-3" /> API Key
                  </Label>
                  <Input id="apiKey" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-abc123..." className="font-mono text-sm" />
                </div>
              </>
            )}

            {scheme === "oauth2" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="accessToken" className="text-xs">Access Token</Label>
                  <Input id="accessToken" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="ya29.a0AW..." className="font-mono text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Token Type</Label>
                  <Input value={tokenType} onChange={(e) => setTokenType(e.target.value)} placeholder="Bearer" />
                </div>
              </>
            )}

            {scheme === "hmac" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hmacSecret" className="text-xs">Secret Key</Label>
                  <Input id="hmacSecret" value={hmacSecret} onChange={(e) => setHmacSecret(e.target.value)} placeholder="your-secret-key" className="font-mono text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hmacPayload" className="text-xs">Payload to Sign</Label>
                  <Input id="hmacPayload" value={hmacPayload} onChange={(e) => setHmacPayload(e.target.value)} placeholder='{"action":"GET"}' className="font-mono text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Algorithm</Label>
                  <Select value={hmacAlgorithm} onValueChange={setHmacAlgorithm}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHA-256">SHA-256</SelectItem>
                      <SelectItem value="SHA-384">SHA-384</SelectItem>
                      <SelectItem value="SHA-512">SHA-512</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scheme === "aws4" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="awsAccessKeyId" className="text-xs">AWS Access Key ID</Label>
                  <Input id="awsAccessKeyId" value={awsAccessKeyId} onChange={(e) => setAwsAccessKeyId(e.target.value)} placeholder="AKIAIOSFODNN7EXAMPLE" className="font-mono text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="awsSecretKey" className="text-xs">AWS Secret Key</Label>
                  <Input id="awsSecretKey" type="password" value={awsSecretKey} onChange={(e) => setAwsSecretKey(e.target.value)} placeholder="wJalrXUtnFEMI/..." className="font-mono text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Region</Label>
                  <Input value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} placeholder="us-east-1" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Service</Label>
                  <Input value={awsService} onChange={(e) => setAwsService(e.target.value)} placeholder="execute-api" />
                </div>
              </>
            )}

            {scheme === "digest" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="digestUser" className="text-xs">Username</Label>
                  <Input id="digestUser" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="digestPass" className="text-xs">Password</Label>
                  <Input id="digestPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </>
            )}

            {scheme === "ntlm" && (
              <p className="text-sm text-muted-foreground col-span-2">
                NTLM requires a multi-step handshake. This generates the Type 1 (Negotiate) message. For actual NTLM authentication, use curl's <code className="bg-muted px-1 rounded">--ntlm</code> flag.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Result */}
      {result && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Generated Header
            </h3>
            <div className="rounded-lg bg-muted/30 border p-3">
              <div className="flex items-center justify-between mb-2">
                <code className="text-sm font-bold">{result.headerName}:</code>
                <CopyButton getText={() => `${result.headerName}: ${result.headerValue}`} label="Copy" />
              </div>
              <code className="text-xs font-mono break-all text-muted-foreground">{result.headerValue}</code>
            </div>

            {/* cURL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Terminal className="h-4 w-4" /> cURL
                </div>
                <CopyButton getText={() => result.curlExample} label="Copy" />
              </div>
              <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{result.curlExample}</pre>
            </div>

            {/* Fetch */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Code2 className="h-4 w-4" /> Fetch API
                </div>
                <CopyButton getText={() => result.fetchExample} label="Copy" />
              </div>
              <pre className="rounded-lg bg-muted/50 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{result.fetchExample}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All header generation happens 100% locally in your browser. No credentials are transmitted anywhere. HMAC signing uses the WebCrypto API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
