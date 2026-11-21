// §1.2 Join screen: the one place people enter a group (T-01, T-03, T-04, T-05).
// TPM review round 3: one "Have you already been added?" dropdown lists EVERYONE in the group.
//   - someone who has signed in before → Enter your PIN → Sign in
//   - someone the organiser added who hasn't signed in → Create a PIN → Join
//   - "No, I'm new here" → Your name (with an "Is that you?" check) → Create a PIN → Join
// The separate "Sign back in" screen is gone; /j/<code>/back opens this same screen.
import * as React from "react";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { NativeSelect } from "../components/ui/native-select";
import { PinBlock, firstPinProblem, type PinValues } from "../components/PinBlock";
import { ErrorAlert, FieldError, Helper, PinField, RateLimitAlert, Shell, clockTime, toastUnexpected, validPin } from "../components/common";
import { t } from "../copy";
import { api, ApiError, type Lookup } from "../lib/api";
import { lastGroup, navigate } from "../lib/router";
import { lookupCache } from "./lookupCache";

export function Join({ code }: { code: string }) {
  const clean = code.toUpperCase().replace(/[\s-]/g, "");
  // Use the copy Home just fetched once, then drop it, so a later visit never sees stale data (BUG-004).
  const [lookup, setLookup] = React.useState<Lookup | null>(() => {
    const cached = lookupCache.get(clean) ?? null;
    lookupCache.delete(clean);
    return cached;
  });
  const [state, setState] = React.useState<"loading" | "ready" | "bad" | "rate">(lookup ? "ready" : "loading");
  const [rateWait, setRateWait] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const known = lookup ?? (await api.lookup(clean));
        if (cancelled) return;
        // T-01: already in this group on this browser → go straight in (C-JOIN-20).
        const me = await api.me().catch(() => ({ groups: [] }));
        if (cancelled) return;
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
      {state === "ready" && lookup && <JoinForm code={clean} lookup={lookup} />}
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

const NEW = "__new__";
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** "Alex" → "Alex B" (or "Alex C"… if that's taken too). */
function suggestName(name: string, members: Lookup["members"]) {
  const taken = new Set(members.map((m) => norm(m.displayName)));
  for (const letter of "BCDEFGHJK") {
    const s = `${name.trim()} ${letter}`;
    if (!taken.has(norm(s))) return s;
  }
  return `${name.trim()} 2`;
}

function JoinForm({ code, lookup }: { code: string; lookup: Lookup }) {
  const groupName = lookup.group.name;
  const members = lookup.members;
  // GR-2: always shown. With nobody in the group yet, "No, I'm new here" is pre-chosen (G32).
  const [selection, setSelection] = React.useState<string>(members.length === 0 ? NEW : "");
  const chosen = members.find((m) => m.displayName === selection);
  const mode: "none" | "new" | "claim" | "signin" =
    selection === "" ? "none" : selection === NEW ? "new" : chosen?.pending ? "claim" : "signin";

  // New person
  const [typedName, setTypedName] = React.useState("");
  const [nameLeft, setNameLeft] = React.useState(false);
  const [differentFrom, setDifferentFrom] = React.useState<string | null>(null); // said "No, I'm a different X"
  // Create a PIN (new person, or a name the organiser added)
  const [pinValues, setPinValues] = React.useState<PinValues>({ pin: "", pin2: "", hint: "" });
  // Sign in (someone who has signed in before)
  const [signinPin, setSigninPin] = React.useState("");
  const [signinError, setSigninError] = React.useState<string | null>(null);
  const [wrongPin, setWrongPin] = React.useState(false);
  const [help, setHelp] = React.useState<"none" | "noPin" | "forgot">("none");
  const [hint, setHint] = React.useState<{ for: string; text: string | null } | null>(null);
  const [lockedUntil, setLockedUntil] = React.useState<number | null>(null);

  const [submitted, setSubmitted] = React.useState(false);
  const [serverHint, setServerHint] = React.useState<string | undefined>();
  const [rateWait, setRateWait] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  // "Is that you?": a new person typed a name someone in the group already uses.
  const duplicate = mode === "new" && typedName.trim()
    ? members.find((m) => norm(m.displayName) === norm(typedName)) : undefined;
  // They said "No, I'm a different X" but typed X again: ask for a name that tells them apart.
  const stillTaken = !!duplicate && differentFrom !== null && norm(duplicate.displayName) === norm(differentFrom);
  const askIsThatYou = !!duplicate && !stillTaken && (nameLeft || submitted);

  const selectionError = submitted && mode === "none" ? t("C-JOIN-29") : undefined;
  const nameError = mode === "new" && (nameLeft || submitted) && !typedName.trim() ? t("C-JOIN-18")
    : stillTaken ? t("C-JOIN-35", { suggestion: suggestName(duplicate!.displayName, members) }) : undefined;

  function choose(value: string) {
    setSelection(value);
    setSubmitted(false); setSigninError(null); setWrongPin(false); setHelp("none"); setLockedUntil(null); setServerHint(undefined);
    const m = members.find((x) => x.displayName === value);
    // GR-7: focus moves to the next field.
    setTimeout(() => document.getElementById(value === NEW ? "name" : m && !m.pending ? "spin" : "pin")?.focus(), 0);
  }

  async function showHint(name: string) {
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
    setSubmitted(true);
    if (mode === "none") { document.getElementById("added")?.focus(); return; }
    if (mode === "signin") return signIn();
    if (mode === "new" && (!typedName.trim() || duplicate)) { setNameLeft(true); document.getElementById("name")?.focus(); return; }
    const p = firstPinProblem(pinValues);
    if (p) { document.getElementById(p)?.focus(); return; }
    const name = mode === "new" ? typedName : selection;
    setBusy(true);
    try {
      const r = await api.join(code, name, pinValues.pin, pinValues.hint.trim() || undefined);
      lastGroup.set(r.group.id);
      toast.success(t("C-JOIN-19", { groupName: r.group.name }));
      navigate(`/g/${r.group.id}`, true);
    } catch (err) {
      // Someone took the name a moment ago: the server's answer becomes the same "Is that you?" question.
      if (err instanceof ApiError && err.code === "name_taken") {
        lookup.members.push({ displayName: name.trim(), pending: false });
        setDifferentFrom(null); setNameLeft(true); document.getElementById("name")?.focus();
      } else if (err instanceof ApiError && err.code === "validation") setServerHint(err.message);
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    if (!validPin(signinPin)) { setSigninError(t("C-JOIN-11")); document.getElementById("spin")?.focus(); return; }
    setSigninError(null);
    setBusy(true);
    try {
      const r = await api.recover(code, selection, signinPin);
      lastGroup.set(r.group.id);
      toast.success(t("C-REC-12", { name: r.member.displayName }), r.pinWasReset ? { description: t("C-REC-11") } : undefined);
      navigate(`/g/${r.group.id}`, true);
    } catch (err) {
      setSigninPin("");
      if (err instanceof ApiError && err.code === "invalid_credentials") {
        setSigninError(t("C-ERR-CREDENTIALS")); setWrongPin(true); document.getElementById("spin")?.focus();
      } else if (err instanceof ApiError && err.code === "locked") { setLockedUntil(Date.now() + err.retryAfterSec * 1000); setWrongPin(true); }
      else if (err instanceof ApiError && err.code === "rate_limited") setRateWait(err.retryAfterSec);
      else toastUnexpected(err);
    } finally {
      setBusy(false);
    }
  }

  const locked = lockedUntil !== null && lockedUntil > Date.now();
  const sorted = [...members].sort((a, b) => norm(a.displayName).localeCompare(norm(b.displayName)));

  return (
    <>
      {rateWait > 0 && <RateLimitAlert seconds={rateWait} />}
      {locked && <ErrorAlert title={t("C-ERR-LOCKED-TITLE")} body={t("C-ERR-LOCKED-BODY", { name: selection, time: clockTime(lockedUntil!) })} />}
      <Card>
        <CardHeader>
          <CardTitle>{t("C-JOIN-02", { groupName })}</CardTitle>
          <CardDescription>{whoIsHere(members)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
            {/* 1. Always shown, always first (GR-2). Lists everyone in the group (round 3). */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="added">{t("C-JOIN-06")}</Label>
              <NativeSelect id="added" value={selection} required aria-invalid={!!selectionError || undefined}
                aria-describedby={selectionError ? "added-error" : "added-help"} onChange={(e) => choose(e.target.value)}>
                <option value="" disabled>{t("C-JOIN-24")}</option>
                {sorted.map((m) => <option key={m.displayName} value={m.displayName}>{m.displayName}</option>)}
                <option value={NEW}>{t("C-JOIN-25")}</option>
              </NativeSelect>
              <FieldError id="added-error">{selectionError}</FieldError>
              <Helper id="added-help">{t("C-JOIN-07")}</Helper>
            </div>

            {/* 2a. New person: their name, with an "Is that you?" check. */}
            {mode === "new" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("C-JOIN-08")}</Label>
                <Input id="name" value={typedName} onChange={(e) => setTypedName(e.target.value)} onBlur={() => setNameLeft(true)}
                  autoComplete="given-name" maxLength={30} aria-invalid={!!nameError || askIsThatYou || undefined}
                  aria-describedby={nameError ? "name-error" : askIsThatYou ? "name-dup" : "name-help"} />
                <FieldError id="name-error">{nameError}</FieldError>
                {askIsThatYou && duplicate && (
                  <div id="name-dup" role="alert" className="border-border flex flex-col gap-3 rounded-lg border p-3">
                    <p className="text-sm font-medium">{t("C-JOIN-32", { name: duplicate.displayName, groupName })}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => choose(duplicate.displayName)}>{t("C-JOIN-33")}</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        setDifferentFrom(duplicate.displayName);
                        setTimeout(() => document.getElementById("name")?.focus(), 0);
                      }}>{t("C-JOIN-34", { name: duplicate.displayName })}</Button>
                    </div>
                  </div>
                )}
                {!nameError && !askIsThatYou && (
                  <Helper id="name-help">{differentFrom ? t("C-JOIN-35", { suggestion: suggestName(differentFrom, members) }) : t("C-JOIN-09")}</Helper>
                )}
              </div>
            )}

            {/* 2b. Create a PIN: new people, and names the organiser added who haven't signed in yet. */}
            {(mode === "new" || mode === "claim") && <PinBlock values={pinValues} onChange={setPinValues} submitted={submitted} serverHintError={serverHint} />}

            {/* 2c. Someone who has signed in before: just their PIN. */}
            {mode === "signin" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="spin">{t("C-REC-05")}</Label>
                  <PinField id="spin" label={t("C-REC-05")} value={signinPin} onChange={(v) => { setSigninPin(v); setSigninError(null); }}
                    invalid={!!signinError} describedBy={signinError ? "spin-error" : undefined} />
                  <FieldError id="spin-error">{signinError}</FieldError>
                </div>
                {hint?.for === selection
                  ? <p className="text-muted-foreground text-sm" aria-live="polite">{hint.text ? t("C-REC-14", { hint: hint.text }) : t("C-REC-15")}</p>
                  : <div><Button type="button" variant="link" size="inline" onClick={() => void showHint(selection)}>{t("C-REC-13")}</Button></div>}
                {/* After a wrong PIN: two ways forward (round 3). */}
                {wrongPin && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={help === "noPin" ? "default" : "outline"} onClick={() => setHelp("noPin")}>{t("C-REC-16")}</Button>
                    <Button type="button" size="sm" variant={help === "forgot" ? "default" : "outline"}
                      onClick={() => { setHelp("forgot"); if (hint?.for !== selection) void showHint(selection); }}>{t("C-REC-17")}</Button>
                  </div>
                )}
                {help === "noPin" && (
                  <Alert>
                    <Info />
                    <AlertDescription className="flex flex-col items-start gap-2">
                      <p>{t("C-REC-18", { name: selection, suggestion: suggestName(selection, members) })}</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        setDifferentFrom(selection); setTypedName(""); setNameLeft(false); choose(NEW);
                      }}>{t("C-REC-19")}</Button>
                    </AlertDescription>
                  </Alert>
                )}
                {help === "forgot" && (
                  <Alert>
                    <Info />
                    <AlertDescription>{t("C-REC-08")}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <Button type="submit" className="h-auto min-h-11 w-full whitespace-normal py-2 text-center"
              disabled={busy || rateWait > 0 || (mode === "signin" && locked)}>
              {busy ? (mode === "signin" ? t("C-REC-07") : t("C-JOIN-15")) : mode === "signin" ? t("C-REC-06") : t("C-JOIN-14", { groupName })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
