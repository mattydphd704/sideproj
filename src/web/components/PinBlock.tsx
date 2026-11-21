// "About your PIN": one block used by every screen that creates a PIN (Join, Start a group),
// so wording, order and checks are identical everywhere (global rules GR-2, GR-3).
import * as React from "react";
import { CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { FieldError, Helper, PinField, hintHasPin, validPin } from "./common";
import { t } from "../copy";

export type PinValues = { pin: string; pin2: string; hint: string };

/** The first problem in the block, for focus after tapping the main button (GR-7). */
export function firstPinProblem(v: PinValues): "pin" | "pin2" | "hint" | null {
  if (!validPin(v.pin)) return "pin";
  if (v.pin2 !== v.pin) return "pin2";
  if (hintHasPin(v.hint, v.pin)) return "hint";
  return null;
}

export function PinBlock({ values, onChange, submitted, serverHintError, ids = { pin: "pin", pin2: "pin2", hint: "hint" } }: {
  values: PinValues;
  onChange: (v: PinValues) => void;
  /** True once the main button has been tapped: shows every remaining problem. */
  submitted: boolean;
  serverHintError?: string;
  ids?: { pin: string; pin2: string; hint: string };
}) {
  const { pin, pin2, hint } = values;
  const [pinLeft, setPinLeft] = React.useState(false);
  const set = (patch: Partial<PinValues>) => onChange({ ...values, ...patch });

  // GR-3: PIN length when leaving the boxes or on submit.
  const pinError = (pinLeft || submitted) && !validPin(pin) ? t("C-JOIN-11") : undefined;
  // GR-3: match checked the moment the 4th number of the second PIN is typed.
  const bothComplete = validPin(pin) && pin2.length === 4;
  const pin2Error = bothComplete && pin2 !== pin ? t("C-JOIN-17")
    : submitted && validPin(pin) && pin2.length < 4 ? t("C-JOIN-31") : undefined;
  const pinsMatch = bothComplete && pin2 === pin;
  // GR-3: hint checked as you type.
  const hintError = hintHasPin(hint, pin) ? t("C-JOIN-28") : serverHintError;

  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="sr-only">{t("C-JOIN-10")}</legend>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.pin}>{t("C-JOIN-10")}</Label>
        <PinField id={ids.pin} label={t("C-JOIN-10")} value={pin} onChange={(v) => set({ pin: v })} invalid={!!pinError}
          describedBy={pinError ? `${ids.pin}-error` : `${ids.pin}-help`} onBlur={() => setPinLeft(true)} />
        {pinError ? <FieldError id={`${ids.pin}-error`}>{pinError}</FieldError> : <Helper id={`${ids.pin}-help`}>{t("C-JOIN-11")}</Helper>}
      </div>
      <Alert>
        <Info />
        <AlertDescription>{t("C-JOIN-12")}</AlertDescription>
      </Alert>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.pin2}>{t("C-JOIN-13")}</Label>
        <PinField id={ids.pin2} label={t("C-JOIN-13")} value={pin2} onChange={(v) => set({ pin2: v })} invalid={!!pin2Error}
          describedBy={pin2Error ? `${ids.pin2}-error` : pinsMatch ? `${ids.pin2}-ok` : undefined} />
        <FieldError id={`${ids.pin2}-error`}>{pin2Error}</FieldError>
        {pinsMatch && (
          <p id={`${ids.pin2}-ok`} className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400" role="status">
            <CheckCircle2 className="size-4" aria-hidden />{t("C-JOIN-30")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.hint}>{t("C-JOIN-26")}</Label>
        <Input id={ids.hint} value={hint} onChange={(e) => set({ hint: e.target.value })} maxLength={40} autoComplete="off"
          aria-invalid={!!hintError || undefined} aria-describedby={hintError ? `${ids.hint}-error` : `${ids.hint}-help`} />
        <FieldError id={`${ids.hint}-error`}>{hintError}</FieldError>
        <Helper id={`${ids.hint}-help`}>{t("C-JOIN-27")}</Helper>
      </div>
    </fieldset>
  );
}
