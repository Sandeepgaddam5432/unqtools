"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import { generateUuids, isValidUuid, type UuidOptions } from "./logic";

export default function UuidGenerator() {
  const [count, setCount] = useState(1);
  const [hyphens, setHyphens] = useState(true);
  const [uppercase, setUppercase] = useState(false);
  const [braces, setBraces] = useState(false);
  const [output, setOutput] = useState("");

  const generate = useCallback(() => {
    const opts: UuidOptions = { hyphens, uppercase, braces };
    const uuids = generateUuids(count, opts);
    setOutput(uuids.join("\n"));
    toast.success(`Generated ${count} UUID${count === 1 ? "" : "s"}`);
  }, [count, hyphens, uppercase, braces]);

  const loadSample = useCallback(() => {
    setCount(5);
    generate();
  }, [generate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Count</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={hyphens} onCheckedChange={setHyphens} id="uuid-hyphens" />
              <Label htmlFor="uuid-hyphens" className="text-sm cursor-pointer">Hyphens</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={uppercase} onCheckedChange={setUppercase} id="uuid-upper" />
              <Label htmlFor="uuid-upper" className="text-sm cursor-pointer">Uppercase</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={braces} onCheckedChange={setBraces} id="uuid-braces" />
              <Label htmlFor="uuid-braces" className="text-sm cursor-pointer">{`{Braces}`}</Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={generate}>Generate</Button>
              <Button variant="ghost" size="sm" onClick={loadSample}>Sample (5)</Button>
              <Button variant="ghost" size="sm" onClick={() => setOutput("")} disabled={!output}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {output && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{output.split("\n").length} UUIDs</Badge>
              <CopyButton getText={() => output} />
              <DownloadButton getText={() => output} filename="uuids.txt" />
            </div>
          </div>
          <pre className="min-h-[120px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output}
          </pre>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all UUIDs generated locally via <code>crypto.randomUUID()</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
