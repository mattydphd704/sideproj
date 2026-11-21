// §1.2 Join (T-01, T-03, T-04) and §1.3 Sign back in (T-05) on one screen.
import * as React from "react";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ErrorAlert, FieldError, Helper, PinField, RateLimitAlert, Shell, clockTime, toastUnexpected, validPin } from "../components/common";
import { t } from "../copy";
import { api, ApiError, type Lookup } from "../lib/api";
import { lastGroup, navigate } from "../lib/router";
import { lookupCache } from "./lookupCache";

type Mode = "join" | "recover";

export function Join({ code, initialMode }: { code: string; initialMode: Mode }) {
  const clean = code.toUpperCase().replace(/[\s-]/g, "");
  const [lookup, setLookup] = React.useState<Lookup | null>(lookupCache.get(clean) ?? null);
  const [state, setState] = React.useState<"loading" | "ready" | "bad" | "rate">(lookup ? "ready" : "loading");
  const [rateWait, setRateWait] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>(initialMode);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const known = lookup ?? (await api.lookup(clean));
        if (cancelled) return;
        // T-01: already in this group on this browser → go straight in (C-JOIN-20).
        const me = await api.me().catch(() => ({ groups: [] }));
        if (me.groups.some((g) => g.id === known.group.id)) {
          toast(t("C-JOIN-20", { groupName: known.group.name }));
          lastGroup.set(known.group.id);
          navigate(`/g/${known.group.id}`, true);
          return;
        }
        setLookup(known);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "invalid_code") setState("bad");
        else if (err instanceof ApiError && err.code === "rate_limited") { setRateWait(err.retryAfterSec); setState("rate"); }
        else { toastUnexpected(err); setState("bad"); }
      }
    })();
    return () => { cancelled = true; };
  }, [clean]);

  const switchMode = (m: Mode) => {
    setMode(m);
    history.replaceState(null, "", m === "recover" ? `/j/${code}/back` : `/j/${code}`);
  };

  return (
    <Shell>
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/?add=1")}><ArrowLeft />{t("C-JOIN-01")}</Button>
      </div>
      {state === "loading" && <Card aria-busy="true"><CardContent><div className="bg-muted h-24 animate-pulse rounded-md" /></CardContent></Card>}
      {state === "rate" && <RateLimitAlert seconds={rateWait} />}
      {state === "bad" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("C-JOIN-21")}</CardTitle>
            <CardDescription>{t("C-JOIN-22")}</CardDescription>
          </CardHeader>
          <CardContent><Button className="w-full" onClick={() => navigate("/?add=1")}>{t("C-JOIN-23")}</Button></CardContent>
        </Card>
      )}
      {state === "ready" && lookup && (mode === "join"
        ? <JoinForm code={clean} lookup={lookup} onRecover={() => switchMode("recover")} />
        : <RecoverForm code={clean} lookup={lookup} onJoin={() => switchMode("join")} />)}
    </Shell>
  );
}

function whoIsHere(members: Lookup["members"]) {
  const joined = members.filter((m) => !m.pending).map((m) => m.displayName);
  if (joined.length === 0) return t("C-JOIN-05");
  if (joined.length <= 3) {
    const names = joined.length === 1 ? joined[0]! : `${joined.slice(0, -1).join(", ")} and ${joined.at(-1)}`;
    return t("C-JOIN-03", { names });
  }
  return t("C-JOIN-04", { names: joined.slice(0, 3).join(", "), n: joined.length - 3 });
}

function JoinForm({ code, lookup, onRecover }: { code: string; lookup: Lookup; onRecover: () => void }) {
  const groupName = lookup.group.name;
  const pending = lookup.members.filter((m) => m.pending);
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pin2, setPin2] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: React.ReactNode; pin?: string; pin2?: string }>({});
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("C-JOIN-18");
    if (!validPin(pin)) next.pin = t("C-JOIN-11");
    else if (pin !== pin2) next.pin2 = t("C-JOIN-17");
    setErrors(next);
    if (next.name) { nameRef.current?.focus(); return; }
    if (next.pin || next.pin2) { setPin2(""); return; }
    setBusy(true);
    try {
      const r = await api.join(code, name, pin);
      lastGroup.set(r.group.id);
      toast.success(t("C-JOIN-19", { groupName: r.group.name }));
      navigate(`/g/${r.group.id}`, true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "name_taken") {
        setErrors({
          name: (
            <>
              {t("C-ERR-NAME-TAKEN")}{" "}
              <Button type="button" variant="link" size="inline" onClick={onRecover}>{t("C-ERR-NAME-TAKEN-LINK")}</Button>
            </>
          ),
        });
        nameRef.current?.focus();
      } else if (err instanceof ApiError && err.code === "validation") setErrors({ name: err.message });
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {rateWait > 0 && <RateLimitAlert seconds={rateWait} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("C-JOIN-02", { groupName })}</CardTitle>
          <CardDescription>{whoIsHere(lookup.members)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            {pending.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{t("C-JOIN-06")}</legend>
                <div className="flex flex-wrap gap-2">
                  {pending.map((m) => (
                    <Button key={m.displayName} type="button" variant={name === m.displayName ? "default" : "outline"} size="sm"
                      aria-pressed={name === m.displayName}
                      onClick={() => { setName(m.displayName); document.getElementById("pin")?.focus(); }}>
                      {m.displayName}
                    </Button>
                  ))}
                </div>
                <Helper>{t("C-JOIN-07")}</Helper>
              </fieldset>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("C-JOIN-08")}</Label>
              <Input id="name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name"
                maxLength={30} aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? "name-error" : "name-help"} />
              <FieldError id="name-error">{errors.name}</FieldError>
              <Helper id="name-help">{t("C-JOIN-09")}</Helper>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pin">{t("C-JOIN-10")}</Label>
              <PinField id="pin" label={t("C-JOIN-10")} value={pin} onChange={setPin} invalid={!!errors.pin} describedBy="pin-help" />
              <FieldError id="pin-error">{errors.pin}</FieldError>
              <Helper id="pin-help">{t("C-JOIN-11")}</Helper>
            </div>
            <Alert>
              <Info />
              <AlertDescription>{t("C-JOIN-12")}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pin2">{t("C-JOIN-13")}</Label>
              <PinField id="pin2" label={t("C-JOIN-13")} value={pin2} onChange={setPin2} invalid={!!errors.pin2} describedBy={errors.pin2 ? "pin2-error" : undefined} />
              <FieldError id="pin2-error">{errors.pin2}</FieldError>
            </div>
            <Button type="submit" className="h-auto min-h-11 w-full whitespace-normal py-2 text-center" disabled={busy || rateWait > 0}>
              {busy ? t("C-JOIN-15") : t("C-JOIN-14", { groupName })}
            </Button>
            <Button type="button" variant="link" onClick={onRecover}>{t("C-JOIN-16")}</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function RecoverForm({ code, lookup, onJoin }: { code: string; lookup: Lookup; onJoin: () => void }) {
  const groupName = lookup.group.name;
  const joined = lookup.members.filter((m) => !m.pending);
  const [name, setName] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState<{ field?: "name" | "pin"; text: string } | null>(null);
  const [lockedUntil, setLockedUntil] = React.useState<number | null>(null);
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) { setError({ field: "name", text: t("C-REC-10") }); return; }
    if (!validPin(pin)) { setError({ field: "pin", text: t("C-JOIN-11") }); return; }
    setError(null);
    setBusy(true);
    try {
      const r = await api.recover(code, name, pin);
      lastGroup.set(r.group.id);
      toast.success(t("C-REC-12", { name: r.member.displayName }), r.pinWasReset ? { description: t("C-REC-11") } : undefined);
      navigate(`/g/${r.group.id}`, true);
    } catch (err) {
      setPin("");
      if (err instanceof ApiError && err.code === "invalid_credentials") { setError({ field: "pin", text: t("C-ERR-CREDENTIALS") }); document.getElementById("rpin")?.focus(); }
      else if (err instanceof ApiError && err.code === "locked") setLockedUntil(Date.now() + err.retryAfterSec * 1000);
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  const locked = lockedUntil !== null && lockedUntil > Date.now();
  return (
    <>
      {rateWait > 0 && <RateLimitAlert seconds={rateWait} />}
      {locked && <ErrorAlert title={t("C-ERR-LOCKED-TITLE")} body={t("C-ERR-LOCKED-BODY", { name, time: clockTime(lockedUntil!) })} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("C-REC-01", { groupName })}</CardTitle>
          <CardDescription>{t("C-REC-02")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rname">{t("C-REC-03")}</Label>
              <Select value={name} onValueChange={(v) => { setName(v); setLockedUntil(null); }}>
                <SelectTrigger id="rname" aria-invalid={error?.field === "name" || undefined}>
                  <SelectValue placeholder={t("C-REC-04")} />
                </SelectTrigger>
                <SelectContent>
                  {joined.map((m) => <SelectItem key={m.displayName} value={m.displayName}>{m.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
              {error?.field === "name" && <FieldError id="rname-error">{error.text}</FieldError>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rpin">{t("C-REC-05")}</Label>
              <PinField id="rpin" label={t("C-REC-05")} value={pin} onChange={setPin} invalid={error?.field === "pin"} describedBy={error?.field === "pin" ? "rpin-error" : undefined} />
              {error?.field === "pin" && <FieldError id="rpin-error">{error.text}</FieldError>}
            </div>
            <Button type="submit" className="w-full" disabled={busy || locked || rateWait > 0}>{busy ? t("C-REC-07") : t("C-REC-06")}</Button>
            <Helper>{t("C-REC-08")}</Helper>
            <Button type="button" variant="link" onClick={onJoin}>{t("C-REC-09")}</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
