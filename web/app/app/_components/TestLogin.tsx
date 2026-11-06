"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Mail, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/client/api";
import { errorText, notify } from "./shared";
import { Spinner } from "./kit";

/// A random test address. It is not a real mailbox. OTP verification comes later.
function randomTestEmail(): string {
  const id = Math.random().toString(36).slice(2, 10);
  return `tester-${id}@sword.test`;
}

/// Testing login. Shown on the sign-in page. Signs in with a generated email, with no verification.
export function TestLogin({ role, onSignedIn }: { role: "customer" | "merchant"; onSignedIn: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [email, setEmail] = useState(randomTestEmail);
  const [busy, setBusy] = useState(false);

  async function useEmail() {
    setBusy(true);
    try {
      await api("/api/auth/test-login", { email, role });
      notify("success", "Signed in with a test email");
      onSignedIn();
    } catch (err) {
      notify("error", errorText(err, "Test login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-warning/15 text-warning">
            <FlaskConical className="size-3.5" />
          </span>
          <div>
            <p className="text-sm font-medium">Testing mode</p>
            <p className="text-[11px] text-muted-foreground">No verification, test addresses only</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Testing mode" />
      </div>
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 pt-4">
              <div className="space-y-2">
                <Label htmlFor="test-email" className="text-xs">Login with email</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="test-email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-xl bg-background pl-9 font-mono text-xs" />
                  </div>
                  <Button variant="outline" size="icon" className="size-10 rounded-xl" aria-label="Generate another address" onClick={() => setEmail(randomTestEmail())}>
                    <Shuffle className="size-4" />
                  </Button>
                </div>
              </div>
              <Button className="h-10 w-full rounded-xl" onClick={useEmail} disabled={busy}>
                {busy && <Spinner />}
                {busy ? "Signing in…" : "Use this email"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
