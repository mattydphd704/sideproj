// §1.4 Start a group (T-06), Waiting (T-07), Declined (T-08).
import * as React from "react";
import { ArrowLeft, Hourglass, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { NativeSelect } from "../components/ui/native-select";
import { PinBlock, firstPinProblem, type PinValues } from "../components/PinBlock";
import { FieldError, Helper, RateLimitAlert, Shell, toastUnexpected } from "../components/common";
import { t } from "../copy";
import { api, ApiError, type RequestStatus } from "../lib/api";
import { lastGroup, navigate } from "../lib/router";
import { COMMON_CURRENCIES, currencyLabel, guessCurrency } from "../lib/currency";

const POLL_MS = 30_000; // same cadence as the dashboard (ADR-07)

export function NewGroup() {
  const [status, setStatus] = React.useState<RequestStatus | "none" | "loading">("loading");
  const [checkedAt, setCheckedAt] = React.useState<number>(Date.now());

  const alive = React.useRef(true); // a screen that has closed must not navigate (BUG-005)
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const check = React.useCallback(async () => {
    try {
      const r = await api.currentRequest();
      if (!alive.current) return;
      setCheckedAt(Date.now());
      if (r.status === "approved" && r.group) {
        lastGroup.set(r.group.id);
        toast.success(t("C-NEW-20", { groupName: r.group.name }));
        navigate(`/g/${r.group.id}`, true);
        return;
      }
      setStatus(r);
    } catch (err) {
      if (!alive.current) return;
      if (err instanceof ApiError && err.code === "no_request") setStatus("none");
      else { toastUnexpected(err); setStatus((s) => (s === "loading" ? "none" : s)); }
    }
  }, []);

  React.useEffect(() => { void check(); }, [check]);

  // Check every 30 s while waiting, only while the tab is visible (ADR-07), and when it regains focus.
  React.useEffect(() => {
    if (typeof status !== "object" || status.status !== "pending") return;
    const tick = () => { if (document.visibilityState === "visible") void check(); };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [status, check]);

  if (status === "loading") return <Shell><Card aria-busy="true"><CardContent><div className="bg-muted h-24 animate-pulse rounded-md" /></CardContent></Card></Shell>;
  if (status === "none") return <RequestForm onSent={(groupName) => { setStatus({ status: "pending", groupName }); setCheckedAt(Date.now()); }} />;
  if (status.status === "declined") return <Declined groupName={status.groupName} onAgain={() => setStatus("none")} />;
  return <Waiting groupName={status.groupName} checkedAt={checkedAt} onCheck={check} />;
}

function RequestForm({ onSent }: { onSent: (groupName: string) => void }) {
  const [groupName, setGroupName] = React.useState("");
  const [currency, setCurrency] = React.useState(guessCurrency());
  const [name, setName] = React.useState("");
  const [left, setLeft] = React.useState<{ group?: boolean; name?: boolean }>({});
  const [pinValues, setPinValues] = React.useState<PinValues>({ pin: "", pin2: "", hint: "" });
  const [submitted, setSubmitted] = React.useState(false);
  const [server, setServer] = React.useState<{ group?: string; hint?: string }>({});
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const currencies = COMMON_CURRENCIES.includes(currency) ? COMMON_CURRENCIES : [currency, ...COMMON_CURRENCIES];

  // GR-3: checked when leaving the field and when tapping the main button.
  const groupError = server.group ?? ((left.group || submitted) && !groupName.trim() ? t("C-NEW-18")
    : groupName.trim().length > 60 ? t("C-NEW-19") : undefined);
  const nameError = (left.name || submitted) && !name.trim() ? t("C-JOIN-18") : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    // GR-7: focus the first field with a problem.
    if (!groupName.trim() || groupName.trim().length > 60) { document.getElementById("gname")?.focus(); return; }
    if (!name.trim()) { document.getElementById("yname")?.focus(); return; }
    const p = firstPinProblem(pinValues);
    if (p) { document.getElementById(p === "pin" ? "npin" : p === "pin2" ? "npin2" : "hint")?.focus(); return; }
    setBusy(true);
    try {
      const r = await api.requestGroup({ groupName, currency, displayName: name, pin: pinValues.pin, pinHint: pinValues.hint.trim() || undefined });
      onSent(r.request.groupName);
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation") setServer(/hint/i.test(err.message) ? { hint: err.message } : { group: err.message });
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div><Button variant="ghost" size="sm" onClick={() => navigate("/?add=1")}><ArrowLeft />{t("C-JOIN-01")}</Button></div>
      {rateWait > 0 && <RateLimitAlert seconds={rateWait} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("C-NEW-01")}</CardTitle>
          <CardDescription>{t("C-NEW-02")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gname">{t("C-NEW-03")}</Label>
              <Input id="gname" value={groupName} onChange={(e) => { setGroupName(e.target.value); setServer({}); }} onBlur={() => setLeft((l) => ({ ...l, group: true }))}
                placeholder={t("C-NEW-04")} maxLength={60} aria-invalid={!!groupError || undefined} aria-describedby={groupError ? "gname-error" : undefined} />
              <FieldError id="gname-error">{groupError}</FieldError>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">{t("C-NEW-05")}</Label>
              <NativeSelect id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-describedby="currency-help">
                {currencies.map((c) => <option key={c} value={c}>{currencyLabel(c)}</option>)}
              </NativeSelect>
              <Helper id="currency-help">{t("C-NEW-06")}</Helper>
            </div>
            {/* Same "Your name" field and PIN block as the Join screen (GR-2). */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="yname">{t("C-NEW-07")}</Label>
              <Input id="yname" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setLeft((l) => ({ ...l, name: true }))}
                autoComplete="given-name" maxLength={30} aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "yname-error" : "yname-help"} />
              <FieldError id="yname-error">{nameError}</FieldError>
              <Helper id="yname-help">{t("C-JOIN-09")}</Helper>
            </div>
            <PinBlock values={pinValues} onChange={setPinValues} submitted={submitted} serverHintError={server.hint}
              ids={{ pin: "npin", pin2: "npin2", hint: "hint" }} />
            <Button type="submit" className="w-full" disabled={busy || rateWait > 0}>{busy ? t("C-NEW-09") : t("C-NEW-08")}</Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

function relative(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return s < 3600 ? rtf.format(-Math.round(s / 60), "minute") : rtf.format(-Math.round(s / 3600), "hour");
}

function Waiting({ groupName, checkedAt, onCheck }: { groupName: string; checkedAt: number; onCheck: () => Promise<void> }) {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => { const id = setInterval(force, 15_000); return () => clearInterval(id); }, []);
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Hourglass className="size-5" aria-hidden />{t("C-NEW-10")}</CardTitle>
          <CardDescription>{t("C-NEW-11", { groupName })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert><Info /><AlertDescription>{t("C-NEW-12")}</AlertDescription></Alert>
          <p className="text-muted-foreground text-sm" aria-live="polite">{t("C-NEW-13", { time: relative(checkedAt) })}</p>
          <Button variant="outline" className="w-full" onClick={() => void onCheck()}>{t("C-NEW-14")}</Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Declined({ groupName, onAgain }: { groupName: string; onAgain: () => void }) {
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{t("C-NEW-15")}</CardTitle>
          <CardDescription aria-live="polite">{t("C-NEW-16", { groupName })}</CardDescription>
        </CardHeader>
        <CardContent><Button className="w-full" onClick={onAgain}>{t("C-NEW-17")}</Button></CardContent>
      </Card>
    </Shell>
  );
}
