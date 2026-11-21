// §1.2 Join (T-01, T-03, T-04) and §1.3 Sign back in (T-05) on one screen.
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { NativeSelect } from "../components/ui/native-select";
import { PinBlock, firstPinProblem, type PinValues } from "../components/PinBlock";
import { ErrorAlert, FieldError, Helper, PinField, RateLimitAlert, Shell, clockTime, toastUnexpected, validPin } from "../components/common";
import { t } from "../copy";
import { api, ApiError, type Lookup } from "../lib/api";
import { lastGroup, navigate } from "../lib/router";
import { lookupCache } from "./lookupCache";

type Mode = "join" | "recover";

export function Join({ code, initialMode }: { code: string; initialMode: Mode }) {
  const clean = code.toUpperCase().replace(/[\s-]/g, "");
  // Use the copy Home just fetched once, then drop it, so a later visit never sees stale data (BUG-004).
  const [lookup, setLookup] = React.useState<Lookup | null>(() => {
    const cached = lookupCache.get(clean) ?? null;
    lookupCache.delete(clean);
    return cached;
  });
  const [state, setState] = React.useState<"loading" | "ready" | "bad" | "rate">(lookup ? "ready" : "loading");
  const [rateWait, setRateWait] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>(initialMode);
  React.useEffect(() => setMode(initialMode), [initialMode]);

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
    navigate(m === "recover" ? `/j/${code}/back` : `/j/${code}`, true);
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
  const NEW = "__new__";
  // GR-2: "Have you already been added?" is always shown. With nobody waiting, "No, I'm new here" is pre-chosen (G32).
  const [added, setAdded] = React.useState<string>(pending.length === 0 ? NEW : "");
  const [typedName, setTypedName] = React.useState("");
  const [nameLeft, setNameLeft] = React.useState(false);
  const name = added && added !== NEW ? added : typedName;
  const [pinValues, setPinValues] = React.useState<PinValues>({ pin: "", pin2: "", hint: "" });
  const [submitted, setSubmitted] = React.useState(false);
  const [server, setServer] = React.useState<{ name?: React.ReactNode; hint?: string }>({});
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const addedError = submitted && added === "" ? t("C-JOIN-29") : undefined;
  const nameError = server.name ?? ((nameLeft || submitted) && added === NEW && !typedName.trim() ? t("C-JOIN-18") : undefined);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    // GR-7: focus the first field with a problem.
    if (added === "") { document.getElementById("added")?.focus(); return; }
    if (added === NEW && !typedName.trim()) { document.getElementById("name")?.focus(); return; }
    const p = firstPinProblem(pinValues);
    if (p) { document.getElementById(p)?.focus(); return; }
    setBusy(true);
    try {
      const r = await api.join(code, name, pinValues.pin, pinValues.hint.trim() || undefined);
      lastGroup.set(r.group.id);
      toast.success(t("C-JOIN-19", { groupName: r.group.name }));
      navigate(`/g/${r.group.id}`, true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "name_taken") {
        setServer({
          name: (
            <>
              {t("C-ERR-NAME-TAKEN")}{" "}
              <Button type="button" variant="link" size="inline" onClick={onRecover}>{t("C-ERR-NAME-TAKEN-LINK")}</Button>
            </>
          ),
        });
        document.getElementById(added === NEW ? "name" : "added")?.focus();
      } else if (err instanceof ApiError && err.code === "validation") setServer(/hint/i.test(err.message) ? { hint: err.message } : { name: err.message });
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
            {/* 1. Always shown (GR-2). Lists only people the organiser added who haven't signed in yet (FR-2.2). */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="added">{t("C-JOIN-06")}</Label>
              <NativeSelect id="added" value={added} required aria-invalid={!!addedError || undefined}
                aria-describedby={addedError ? "added-error" : "added-help"}
                onChange={(e) => {
                  const v = e.target.value;
                  setAdded(v); setServer({});
                  setTimeout(() => document.getElementById(v === NEW ? "name" : "pin")?.focus(), 0); // GR-7
                }}>
                <option value="" disabled>{t("C-JOIN-24")}</option>
                {pending.map((m) => <option key={m.displayName} value={m.displayName}>{m.displayName}</option>)}
                <option value={NEW}>{t("C-JOIN-25")}</option>
              </NativeSelect>
              <FieldError id="added-error">{addedError}</FieldError>
              <Helper id="added-help">{t("C-JOIN-07")}</Helper>
            </div>
            {/* 2. Only for new people. */}
            {added === NEW && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("C-JOIN-08")}</Label>
                <Input id="name" value={typedName} onChange={(e) => { setTypedName(e.target.value); setServer({}); }} onBlur={() => setNameLeft(true)}
                  autoComplete="given-name" maxLength={30} aria-invalid={!!nameError || undefined} aria-describedby={nameError ? "name-error" : "name-help"} />
                <FieldError id="name-error">{nameError}</FieldError>
                <Helper id="name-help">{t("C-JOIN-09")}</Helper>
              </div>
            )}
            {added !== NEW && server.name && <FieldError id="added-server-error">{server.name}</FieldError>}
            {/* 3. About your PIN, once step 1 is answered. */}
            {added !== "" && <PinBlock values={pinValues} onChange={setPinValues} submitted={submitted} serverHintError={server.hint} />}
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
  const [hint, setHint] = React.useState<{ for: string; text: string | null } | null>(null);

  async function showHint() {
    try {
      const r = await api.hint(code, name);
      setHint({ for: name, text: r.hint });
    } catch (err) {
      if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    }
  }

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
              <NativeSelect id="rname" value={name} required aria-invalid={error?.field === "name" || undefined}
                aria-describedby={error?.field === "name" ? "rname-error" : undefined}
                onChange={(e) => { setName(e.target.value); setLockedUntil(null); setError(null); setTimeout(() => document.getElementById("rpin")?.focus(), 0); }}>
                <option value="" disabled>{t("C-REC-04")}</option>
                {joined.map((m) => <option key={m.displayName} value={m.displayName}>{m.displayName}</option>)}
              </NativeSelect>
              {error?.field === "name" && <FieldError id="rname-error">{error.text}</FieldError>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rpin">{t("C-REC-05")}</Label>
              <PinField id="rpin" label={t("C-REC-05")} value={pin} onChange={setPin} invalid={error?.field === "pin"} describedBy={error?.field === "pin" ? "rpin-error" : undefined} />
              {error?.field === "pin" && <FieldError id="rpin-error">{error.text}</FieldError>}
              {name && (hint?.for === name
                ? <p className="text-muted-foreground text-sm" aria-live="polite">{hint.text ? t("C-REC-14", { hint: hint.text }) : t("C-REC-15")}</p>
                : <div><Button type="button" variant="link" size="inline" onClick={() => void showHint()}>{t("C-REC-13")}</Button></div>)}
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
