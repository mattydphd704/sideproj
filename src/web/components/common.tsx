// Small shared pieces used by the Section 1 screens.
import * as React from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { t } from "../copy";
import { ApiError } from "../lib/api";
import { toast } from "sonner";

/** Centred single-card layout for screens outside a group (UI_INTERACTION_MAPS §1.0). */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-5 px-4 py-6">
      {children}
    </main>
  );
}

/** Error text linked to a field with aria-describedby. */
export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return <p id={id} className="text-destructive text-sm" role="alert">{children}</p>;
}

export function Helper({ id, children }: { id?: string; children: React.ReactNode }) {
  return <p id={id} className="text-muted-foreground text-sm">{children}</p>;
}

/** PIN entry: 4 boxes, digits only, numbers visible while typing (TPM UI review round 1). */
export function PinField(props: { id: string; value: string; onChange: (v: string) => void; label: string; invalid?: boolean; describedBy?: string; autoFocus?: boolean; onBlur?: () => void }) {
  return (
    <InputOTP
      id={props.id}
      maxLength={4}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      value={props.value}
      onChange={props.onChange}
      aria-label={`${props.label}, 4 numbers`}
      aria-invalid={props.invalid || undefined}
      aria-describedby={props.describedBy}
      autoFocus={props.autoFocus}
      onBlur={props.onBlur}
    >
      <InputOTPGroup>
        {[0, 1, 2, 3].map((i) => <InputOTPSlot key={i} index={i} aria-invalid={props.invalid || undefined} />)}
      </InputOTPGroup>
    </InputOTP>
  );
}

export const validPin = (p: string) => /^\d{4}$/.test(p);

/** Mirrors the server rule: the hint must not contain the PIN (G29). */
export const hintHasPin = (hint: string, pin: string) => pin.length === 4 && hint.replace(/\D/g, "").includes(pin);

export function RateLimitAlert({ seconds }: { seconds: number }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{t("C-ERR-RATE", { minutes: Math.max(1, Math.ceil(seconds / 60)) })}</AlertDescription>
    </Alert>
  );
}

export function ErrorAlert({ title, body }: { title?: string; body: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}

/** Errors with no specific place on the screen become toasts (C-ERR-OFFLINE, C-ERR-SERVER, C-ERR-CSRF). */
export function toastUnexpected(e: unknown) {
  if (e instanceof ApiError && e.code === "offline") toast.error(t("C-ERR-OFFLINE"));
  else if (e instanceof ApiError && e.code === "csrf") toast.error(t("C-ERR-CSRF"));
  else toast.error(t("C-ERR-SERVER"));
}

/** "3:42 PM" in the person's own format. */
export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
