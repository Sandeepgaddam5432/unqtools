"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { calculateStrength, generateSalt, generateSimulatedHash, PRESETS, type Argon2Params } from "./logic";
import { Key, Shield, Dice5, Info } from "lucide-react";

export default function Argon2HashGenerator() {
  const [password, setPassword] = useState("");
  const [type, setType] = useState<Argon2Params["type"]>("argon2id");
  const [memory, setMemory] = useState(65536);
  const [iterations, setIterations] = useState(3);
  const [parallelism, setParallelism] = useState(4);
  const [hashLength, setHashLength] = useState(32);
  const [salt, setSalt] = useState(() => generateSalt());

  const params: Argon2Params = { type, memoryCost: memory, iterations, parallelism, hashLength, salt };
  const strength = useMemo(() => calculateStrength(params), [params]);
  const hash = useMemo(() => password ? generateSimulatedHash(password, params) : "", [password, params]);

  const applyPreset = useCallback((name: string) => {
    const p = PRESETS[name];
    if (p) { setType(p.type); setMemory(p.memoryCost); setIterations(p.iterations); setParallelism(p.parallelism); toast.info(`Preset "${name}" applied`); }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={v => setType(v as Argon2Params["type"])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="argon2d">Argon2d</SelectItem>
                  <SelectItem value="argon2i">Argon2i</SelectItem>
                  <SelectItem value="argon2id">Argon2id</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Memory (KB)</Label>
              <Input type="number" value={memory} onChange={e => setMemory(Number(e.target.value))} className="w-28 h-9" min={8} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Iterations</Label>
              <Input type="number" value={iterations} onChange={e => setIterations(Number(e.target.value))} className="w-20 h-9" min={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Parallelism</Label>
              <Input type="number" value={parallelism} onChange={e => setParallelism(Number(e.target.value))} className="w-20 h-9" min={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Hash Length</Label>
              <Input type="number" value={hashLength} onChange={e => setHashLength(Number(e.target.value))} className="w-20 h-9" min={4} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Preset</Label>
              <Select onValueChange={applyPreset}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PRESETS).map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Strength:</Label>
            <Badge className={strength.score >= 4 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : strength.score >= 2 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-destructive/10 text-destructive"}>
              {strength.label}
            </Badge>
            <Badge variant="outline">~{strength.timeEstimate} hash time</Badge>
            <Button variant="outline" size="sm" onClick={() => setSalt(generateSalt())} className="gap-1.5 ml-auto">
              <Dice5 className="h-3.5 w-3.5" /> New Salt
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Salt (hex)</Label>
            <Input value={salt} onChange={e => setSalt(e.target.value)} className="font-mono text-sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Password</Label>
          </div>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password to hash…" className="font-mono" />
          {hash && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hash Output</Label>
                <CopyButton getText={() => hash} />
              </div>
              <pre className="rounded-lg bg-muted/30 border p-3 text-xs font-mono break-all whitespace-pre-wrap">{hash}</pre>
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="h-3 w-3" /> Simulated hash string — actual Argon2 requires a native library.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% client-side. Password never leaves your browser. Argon2id is recommended for most use cases.</p></CardContent></Card>
    </div>
  );
}
