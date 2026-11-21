// §1.1 Home screen: T-02, and the entry to T-05 and T-06.
import * as React from "react";
import { Gift } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { FieldError, Helper, RateLimitAlert, Shell, toastUnexpected } from "../components/common";
import { t } from "../copy";
import { api, ApiError } from "../lib/api";
import { navigate } from "../lib/router";
import { lookupCache } from "./lookupCache";

export function Home() {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) { setError(t("C-HOME-12")); inputRef.current?.focus(); return; }
    setBusy(true);
    try {
      const result = await api.lookup(code);
      const clean = code.toUpperCase().replace(/[\s-]/g, "");
      lookupCache.set(clean, result);
      navigate(`/j/${clean.slice(0, 4)}-${clean.slice(4)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_code") { setError(t("C-ERR-CODE")); inputRef.current?.focus(); }
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <header className="flex flex-col gap-2 pt-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Gift className="text-brand size-7" aria-hidden />{t("C-HOME-02")}</h1>
        <p className="text-muted-foreground">{t("C-HOME-03")}</p>
      </header>
      {rateWait > 0 && <RateLimitAlert seconds={rateWait} />}
      <Card>
        <CardHeader><CardTitle>{t("C-HOME-04")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <Label htmlFor="code">{t("C-HOME-05")}</Label>
            <Input
              id="code" ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)}
              placeholder={t("C-HOME-06")} autoCapitalize="characters" autoComplete="off" spellCheck={false}
              aria-invalid={!!error || undefined} aria-describedby={error ? "code-error" : "code-help"}
            />
            <FieldError id="code-error">{error}</FieldError>
            <Helper id="code-help">{t("C-HOME-07")}</Helper>
            <Button type="submit" className="w-full" disabled={busy || rateWait > 0}>{busy ? t("C-HOME-09") : t("C-HOME-08")}</Button>
          </form>
        </CardContent>
      </Card>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <Separator className="flex-1" /><span>{t("C-HOME-10")}</span><Separator className="flex-1" />
      </div>
      <Button variant="outline" className="w-full" onClick={() => navigate("/new")}>{t("C-HOME-11")}</Button>
    </Shell>
  );
}
