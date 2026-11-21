// The clickable prototype: real app screens in a phone frame, driven by scenarios,
// with in-line flagging for TPM review.
import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Copy, Flag as FlagIcon, MousePointerClick, RotateCcw, Trash2, X } from "lucide-react";
import { App } from "../web/App";
import { startMemoryRouting, currentPath } from "../web/lib/router";
import { Button } from "../web/components/ui/button";
import { Badge } from "../web/components/ui/badge";
import { cn } from "../web/lib/utils";
import { ORDERED, WORKFLOWS, prepare, type Scenario } from "./scenarios";
import { organiser, getState } from "./mockServer";
import { connectStore, identify, screenName, type Flag, type FlagKind, type Run, type Store } from "./flags";

/** Prototype status messages go to the top bar, not the phone, so they aren't mistaken for the app. */
const notify = (msg: string) => window.dispatchEvent(new CustomEvent("proto:notify", { detail: msg }));

function StatusLine() {
  const [msg, setMsg] = React.useState("");
  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setMsg(""), 3000); };
    window.addEventListener("proto:notify", on);
    return () => { window.removeEventListener("proto:notify", on); clearTimeout(t); };
  }, []);
  return <span role="status" aria-live="polite" className="text-sm font-medium">{msg}</span>;
}

const KIND_LABEL: Record<FlagKind, string> = { change: "Change", question: "Question", bug: "Doesn't work" };

export function Prototype() {
  const [scenario, setScenario] = React.useState<Scenario>(ORDERED[0]!);
  const [runKey, setRunKey] = React.useState(0);
  const [flagMode, setFlagMode] = React.useState(false);
  const [selected, setSelected] = React.useState<{ copyId: string | null; element: string; screen: string } | null>(null);
  const [store, setStore] = React.useState<Store | null>(null);
  const [flags, setFlags] = React.useState<Flag[]>([]);
  const [runs, setRuns] = React.useState<Record<string, Run>>({});
  const [showAll, setShowAll] = React.useState(false);
  const screenRef = React.useRef<HTMLDivElement>(null);

  // Start a scenario: fresh pretend server and browser, then open its first screen.
  const start = React.useCallback((sc: Scenario) => {
    toast.dismiss();
    prepare(sc);
    startMemoryRouting(sc.start);
    setScenario(sc);
    setSelected(null);
    setRunKey((k) => k + 1);
  }, []);

  React.useEffect(() => { start(ORDERED[0]!); }, [start]);

  React.useEffect(() => {
    let offF = () => {}, offR = () => {};
    connectStore().then((s) => { setStore(s); offF = s.onFlags(setFlags); offR = s.onRuns(setRuns); });
    return () => { offF(); offR(); };
  }, []);

  // Flag mode: clicks inside the phone pick an element instead of using it.
  React.useEffect(() => {
    const root = screenRef.current;
    if (!root || !flagMode) return;
    let hovered: Element | null = null;
    const over = (e: MouseEvent) => {
      hovered?.classList.remove("proto-hover");
      hovered = e.target as Element;
      hovered.classList.add("proto-hover");
    };
    const click = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      root.querySelectorAll(".proto-picked").forEach((n) => n.classList.remove("proto-picked"));
      const t = e.target as Element;
      t.classList.add("proto-picked");
      setSelected({ ...identify(t, root), screen: screenName(root) });
    };
    const block = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    root.addEventListener("mouseover", over, true);
    root.addEventListener("click", click, true);
    root.addEventListener("pointerdown", block, true);
    root.addEventListener("mousedown", block, true);
    return () => {
      hovered?.classList.remove("proto-hover");
      root.removeEventListener("mouseover", over, true);
      root.removeEventListener("click", click, true);
      root.removeEventListener("pointerdown", block, true);
      root.removeEventListener("mousedown", block, true);
    };
  }, [flagMode, runKey]);

  React.useEffect(() => {
    if (!flagMode) screenRef.current?.querySelectorAll(".proto-picked").forEach((n) => n.classList.remove("proto-picked"));
  }, [flagMode]);

  const index = ORDERED.findIndex((s) => s.id === scenario.id);
  const flagsHere = flags.filter((f) => f.scenarioId === scenario.id);
  const listed = showAll ? flags : flagsHere;
  const open = flags.filter((f) => f.status === "open").length;

  return (
    <div className="proto-page">
      <header className="proto-topbar">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Prototype · Section 1: Getting in</p>
          <h1 className="text-lg font-semibold text-balance">Gift Lists: workflow scenarios</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusLine />
          <Badge variant="outline">{open} open flag{open === 1 ? "" : "s"}</Badge>
          <Badge variant="secondary" title={store?.mode === "shared" ? "Flags are saved where Claude can read them" : "Flags are saved in this browser only"}>
            {store ? (store.mode === "shared" ? "Flags shared with Claude" : "Flags saved in this browser only") : "Connecting…"}
          </Badge>
        </div>
      </header>

      <div className="proto-grid">
        {/* Workflow picker: every setup and sign-in scenario, always visible, grouped by workflow */}
        <nav aria-label="Workflows and scenarios" className="proto-list">
          <p className="proto-h3">Choose a workflow scenario ({ORDERED.length})</p>
          {WORKFLOWS.map((w) => (
            <div key={w} className="proto-group">
              <h2 className="proto-group-title">{w}</h2>
              <ul className="proto-group-items">
                {ORDERED.filter((s) => s.workflow === w).map((s) => {
                  const r = runs[s.id]; const n = flags.filter((f) => f.scenarioId === s.id && f.status === "open").length;
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => start(s)} aria-current={s.id === scenario.id ? "true" : undefined}
                        className={cn("proto-list-btn", s.id === scenario.id && "is-current")}>
                        <span className="text-muted-foreground font-mono text-xs">{s.id}</span>
                        <span className="min-w-0 flex-1 text-left text-sm leading-snug">{s.title}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {n > 0 && <span className="proto-pill proto-pill-flag" title={`${n} open flag(s)`}>{n}</span>}
                          {r && <span className={cn("proto-pill", r.result === "pass" ? "proto-pill-pass" : "proto-pill-fail")}>{r.result === "pass" ? "OK" : "Fix"}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Phone */}
        <section aria-label="Phone preview" className="proto-stage">
          <div className="proto-stage-bar">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => start(ORDERED[(index - 1 + ORDERED.length) % ORDERED.length]!)} aria-label="Previous scenario"><ChevronLeft /></Button>
              <span className="text-sm font-medium tabular-nums">{scenario.id} · {index + 1} of {ORDERED.length}</span>
              <Button size="sm" variant="outline" onClick={() => start(ORDERED[(index + 1) % ORDERED.length]!)} aria-label="Next scenario"><ChevronRight /></Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={flagMode ? "default" : "outline"} onClick={() => setFlagMode((f) => !f)} aria-pressed={flagMode}>
                <MousePointerClick />{flagMode ? "Flagging: tap an element" : "Flag something"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => start(scenario)}><RotateCcw />Restart</Button>
            </div>
          </div>
          <p className="text-muted-foreground min-w-0 truncate font-mono text-xs" title="Current address in the app">App address: {currentPath()}</p>
          <div className={cn("proto-phone", flagMode && "is-flagging")}>
            <div className="proto-screen" ref={screenRef}>
              <App key={runKey} />
            </div>
          </div>
        </section>

        {/* Scenario details and flags */}
        <aside className="proto-side" aria-label="Scenario details and flags">
          <ScenarioCard sc={scenario} />
          {scenario.organiser && <OrganiserPanel runKey={runKey} />}
          <FlagForm key={`${scenario.id}-${selected?.element}`} selected={selected} scenario={scenario} store={store}
            flagMode={flagMode} onScreenFlag={() => screenRef.current && setSelected({ copyId: null, element: "(whole screen)", screen: screenName(screenRef.current) })}
            onDone={() => { setSelected(null); setFlagMode(false); }} />
          <ResultCard sc={scenario} run={runs[scenario.id]} store={store} />
          <section className="proto-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="proto-h2">Flags {showAll ? "(all scenarios)" : `(${scenario.id})`}</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>{showAll ? "This scenario" : "Show all"}</Button>
            </div>
            {listed.length === 0
              ? <p className="text-muted-foreground text-sm">No flags yet. Tap "Flag something", then tap any part of the phone screen.</p>
              : <ul className="flex flex-col gap-2">{listed.map((f) => <FlagRow key={f.id} f={f} store={store} showScenario={showAll} />)}</ul>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ScenarioCard({ sc }: { sc: Scenario }) {
  const [done, setDone] = React.useState<boolean[]>([]);
  React.useEffect(() => setDone([]), [sc.id]);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => notify("Copied"), () => {});
  };
  return (
    <section className="proto-card">
      <p className="text-muted-foreground text-xs"><span className="font-mono">{sc.id}</span> · {sc.workflow} · <span className="font-mono">{sc.tasks.join(", ")}</span></p>
      <h2 className="text-base font-semibold text-balance">{sc.title}</h2>
      <dl className="proto-dl">
        <dt>Who</dt><dd>{sc.who}</dd>
        <dt>What triggers it</dt><dd>{sc.trigger}</dd>
      </dl>
      <h3 className="proto-h3">Test data</h3>
      <table className="proto-table">
        <tbody>
          {sc.testData.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td><span className="font-mono">{v}</span>
                {!/[ ,(]/.test(v) && <button type="button" className="proto-copy" onClick={() => copy(v)} aria-label={`Copy ${k}`}><Copy className="size-3.5" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="proto-h3">Expected steps</h3>
      <ol className="proto-steps">
        {sc.steps.map((s, i) => (
          <li key={i}>
            <label className="flex items-start gap-2">
              <input type="checkbox" id={`step-${sc.id}-${i}`} className="mt-1 size-4 accent-[var(--brand)]" checked={!!done[i]}
                onChange={(e) => setDone((d) => { const n = [...d]; n[i] = e.target.checked; return n; })} />
              <span className={cn("text-sm", done[i] && "text-muted-foreground line-through")}>{s}</span>
            </label>
          </li>
        ))}
      </ol>
      <h3 className="proto-h3">Expected outcome</h3>
      <p className="proto-outcome">{sc.outcome}</p>
    </section>
  );
}

function OrganiserPanel({ runKey }: { runKey: number }) {
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 500); return () => clearInterval(id); }, [runKey]);
  const pending = organiser.pendingRequest();
  const last = getState().requests.at(-1);
  return (
    <section className="proto-card proto-organiser">
      <h2 className="proto-h2">You, as the organiser</h2>
      <p className="text-muted-foreground text-sm">The admin area isn't built yet. Use these buttons to decide the request.</p>
      {pending ? (
        <>
          <p className="text-sm">Request: <strong>{pending.groupName}</strong> from <strong>{pending.name}</strong> ({pending.currency})</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { organiser.approve(pending.id); tick(); }}><Check />Approve request</Button>
            <Button size="sm" variant="outline" onClick={() => { organiser.decline(pending.id); tick(); }}><X />Decline request</Button>
          </div>
        </>
      ) : (
        <p className="text-sm">{last ? `Last request "${last.groupName}" was ${last.status}. Tap "Check now" in the phone.` : "No request yet. Send one from the phone first."}</p>
      )}
    </section>
  );
}

function FlagForm({ selected, scenario, store, flagMode, onScreenFlag, onDone }: {
  selected: { copyId: string | null; element: string; screen: string } | null; scenario: Scenario; store: Store | null;
  flagMode: boolean; onScreenFlag: () => void; onDone: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [kind, setKind] = React.useState<FlagKind>("change");
  const [busy, setBusy] = React.useState(false);
  if (!selected) {
    return (
      <section className={cn("proto-card", flagMode && "proto-card-active")}>
        <h2 className="proto-h2 flex items-center gap-2"><FlagIcon className="size-4" />Flag a change</h2>
        <p className="text-muted-foreground text-sm">
          {flagMode ? "Tap any text, button or field in the phone. It's highlighted, and its wording ID is filled in here."
            : "Tap \"Flag something\" above the phone, then tap the part you want changed. Or flag the whole screen."}
        </p>
        <div><Button size="sm" variant="outline" onClick={onScreenFlag}>Flag the whole screen</Button></div>
      </section>
    );
  }
  const save = async () => {
    if (!store || !note.trim()) return;
    setBusy(true);
    try {
      await store.addFlag({ scenarioId: scenario.id, screen: selected.screen, copyId: selected.copyId, element: selected.element, note: note.trim(), kind });
      notify("Flag saved");
      setNote(""); onDone();
    } catch { notify("Couldn't save the flag. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <section className="proto-card proto-card-active">
      <h2 className="proto-h2 flex items-center gap-2"><FlagIcon className="size-4" />New flag</h2>
      <dl className="proto-dl">
        <dt>Screen</dt><dd>{selected.screen}</dd>
        <dt>Element</dt><dd>"{selected.element}"{selected.copyId && <> · <span className="font-mono">{selected.copyId}</span></>}</dd>
      </dl>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Kind of flag</legend>
        {(Object.keys(KIND_LABEL) as FlagKind[]).map((k) => (
          <Button key={k} size="sm" type="button" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Button>
        ))}
      </fieldset>
      <label htmlFor="flag-note" className="text-sm font-medium">What should change?</label>
      <textarea id="flag-note" className="proto-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={"e.g. Say \"Choose your name\" instead"} autoFocus />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void save()} disabled={busy || !note.trim() || !store}>Save flag</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </section>
  );
}

function ResultCard({ sc, run, store }: { sc: Scenario; run?: Run; store: Store | null }) {
  const [note, setNote] = React.useState(run?.note ?? "");
  React.useEffect(() => setNote(run?.note ?? ""), [sc.id, run?.note]);
  const set = (result: "pass" | "fail") => store?.setRun({ scenarioId: sc.id, result, note: note.trim(), updatedAt: Date.now() })
    .then(() => notify(result === "pass" ? "Marked as working" : "Marked as needing changes"), () => notify("Couldn't save. Try again."));
  return (
    <section className="proto-card">
      <h2 className="proto-h2">Did it match the expected outcome?</h2>
      {run && <p className="text-sm">Current: <strong>{run.result === "pass" ? "Works as expected" : "Needs changes"}</strong></p>}
      <label htmlFor={`run-note-${sc.id}`} className="sr-only">Optional note</label>
      <textarea id={`run-note-${sc.id}`} className="proto-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note about this scenario" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={run?.result === "pass" ? "default" : "outline"} onClick={() => void set("pass")} disabled={!store}>Works as expected</Button>
        <Button size="sm" variant={run?.result === "fail" ? "destructive" : "outline"} onClick={() => void set("fail")} disabled={!store}>Needs changes</Button>
      </div>
    </section>
  );
}

function FlagRow({ f, store, showScenario }: { f: Flag; store: Store | null; showScenario: boolean }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <li className={cn("proto-flag", f.status === "done" && "is-done")}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className={cn("proto-pill", f.kind === "bug" ? "proto-pill-fail" : f.kind === "question" ? "proto-pill-q" : "proto-pill-flag")}>{KIND_LABEL[f.kind]}</span>
        {f.status === "done" && <span className="proto-pill proto-pill-pass">Done</span>}
        {showScenario && <span className="text-muted-foreground font-mono">{f.scenarioId}</span>}
        <span className="text-muted-foreground">{f.screen}</span>
        {f.copyId && <span className="text-muted-foreground font-mono">{f.copyId}</span>}
      </div>
      <p className="text-muted-foreground text-xs">"{f.element}"</p>
      <p className="text-sm">{f.note}</p>
      {f.resolution && <p className="text-sm"><strong>Resolution:</strong> {f.resolution}</p>}
      {f.status === "open" && (confirm ? (
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" onClick={() => void store?.deleteFlag(f.id)}>Delete flag</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
        </div>
      ) : (
        <div><Button size="sm" variant="ghost" onClick={() => setConfirm(true)}><Trash2 />Delete</Button></div>
      ))}
    </li>
  );
}
