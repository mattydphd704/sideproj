// Every piece of on-screen text, keyed by the C- IDs in docs/UI_INTERACTION_MAPS.md.
// To change wording: update the doc and this file together (TPM feedback loop).
// {placeholders} are filled in by t().

export const COPY = {
  // §1.1 Home
  "C-HOME-01": "Gift Lists",
  "C-HOME-05": "Group code",
  "C-HOME-06": "K7QM-4XTR",
  "C-HOME-07": "Got an invite link? Just open it. It fills this in for you.",
  "C-HOME-08": "Continue",
  "C-HOME-09": "Checking…",
  "C-HOME-10": "or",
  "C-HOME-11": "Start a new group",
  "C-HOME-12": "Enter the code you were given.",

  // §1.2 Join
  "C-JOIN-01": "Back",
  "C-JOIN-02": "Join {groupName}",
  "C-JOIN-03": "Already here: {names}",
  "C-JOIN-04": "Already here: {names} and {n} more",
  "C-JOIN-05": "You're the first one here.",
  "C-JOIN-06": "Have you already been added?",
  "C-JOIN-07": "If the group organiser already added your name, choose it here.",
  "C-JOIN-08": "Your name",
  "C-JOIN-09": "This is how others in the group will see you.",
  "C-JOIN-10": "Create a PIN",
  "C-JOIN-11": "4 numbers.",
  "C-JOIN-12": "You won't need this PIN every time. You'll only need it if you open your list on another device, or after clearing your browser's cookies or cache.",
  "C-JOIN-13": "Enter your PIN again",
  "C-JOIN-14": "Join {groupName}",
  "C-JOIN-15": "Joining…",
  "C-JOIN-16": "Been here before? Sign back in",
  "C-JOIN-17": "The two PINs don't match. Try again.",
  "C-JOIN-18": "Enter your name.",
  "C-JOIN-19": "Welcome to {groupName}!",
  "C-JOIN-20": "You're already in {groupName}.",
  "C-JOIN-21": "This invite didn't work",
  "C-JOIN-22": "The link may be mistyped or out of date. Ask the person who sent it for a new one, or enter a group code.",
  "C-JOIN-23": "Enter a code",
  "C-JOIN-24": "Choose your name",
  "C-JOIN-25": "No, I'm new here",
  "C-JOIN-26": "PIN hint (optional)",
  "C-JOIN-27": "A reminder only you will understand. Don't include your PIN.",
  "C-JOIN-28": "Your hint can't include your PIN.",
  "C-JOIN-29": "Choose your name, or \"No, I'm new here\".",
  "C-JOIN-30": "PINs match.",
  "C-JOIN-31": "Enter your PIN again.",
  "C-ERR-NAME-TAKEN": "Someone in this group already uses that name. If it's you, sign back in instead.",
  "C-ERR-NAME-TAKEN-LINK": "Sign back in",

  // §1.3 Sign back in
  "C-REC-01": "Welcome back to {groupName}",
  "C-REC-02": "Pick your name and enter your PIN.",
  "C-REC-03": "Your name",
  "C-REC-04": "Choose your name",
  "C-REC-05": "PIN",
  "C-REC-06": "Sign in",
  "C-REC-07": "Signing in…",
  "C-REC-08": "Forgot your PIN? Ask the group organiser to reset it.",
  "C-REC-09": "New here? Join instead",
  "C-REC-10": "Choose your name from the list.",
  "C-REC-11": "Your PIN was reset, so the PIN you just entered is now your new PIN.",
  "C-REC-12": "Welcome back, {name}!",
  "C-REC-13": "Show my hint",
  "C-REC-14": "Your hint: {hint}",
  "C-REC-15": "You didn't set a hint.",
  "C-ERR-CREDENTIALS": "That name and PIN didn't match. Check them and try again. After 5 wrong tries, your name is locked for 15 minutes.",
  "C-ERR-LOCKED-TITLE": "Too many wrong PINs",
  "C-ERR-LOCKED-BODY": "For safety, {name} is locked until {time}. Try again then, or ask the group organiser to reset your PIN.",

  // §1.4 Start a group
  "C-NEW-01": "Start a new group",
  "C-NEW-02": "Tell us about your group. The app's organiser approves new groups.",
  "C-NEW-03": "Group name",
  "C-NEW-04": "e.g. Smith Family",
  "C-NEW-05": "Currency",
  "C-NEW-06": "Used when a price doesn't say.",
  "C-NEW-07": "Your name",
  "C-NEW-08": "Send request",
  "C-NEW-09": "Sending…",
  "C-NEW-10": "Waiting for approval",
  "C-NEW-11": "We'll move you into \"{groupName}\" as soon as it's approved.",
  "C-NEW-12": "You can close this page. Come back on this same phone or computer to get in.",
  "C-NEW-13": "Last checked: {time}",
  "C-NEW-14": "Check now",
  "C-NEW-15": "Your request wasn't approved",
  "C-NEW-16": "Your request for \"{groupName}\" wasn't approved. If you think this is a mistake, contact the app's organiser.",
  "C-NEW-17": "Send a new request",
  "C-NEW-18": "Enter a name for your group.",
  "C-NEW-19": "Group names can be up to 60 characters.",
  "C-NEW-20": "\"{groupName}\" is ready. Welcome!",

  // §1.5 Shared messages
  "C-ERR-CODE": "That group code didn't work. Check it and try again.",
  "C-ERR-RATE": "Too many attempts. Please wait {minutes} minutes and try again.",
  "C-ERR-OFFLINE": "You're offline. Check your connection and try again.",
  "C-ERR-SERVER": "Something went wrong. Please try again.",
  "C-ERR-CSRF": "This request was blocked for security reasons. Refresh the page and try again.",

  // Temporary: inside-a-group placeholder until Section 2 (My list) is mapped and built.
  "C-TMP-GROUP-01": "Signed in as {name}",
  "C-TMP-GROUP-02": "Your list, everyone's lists and your claims will appear here. These screens come in the next sections of the interaction maps.",
  "C-TMP-GROUP-03": "Join another group",
} as const;

export type CopyId = keyof typeof COPY;

export function t(id: CopyId, vars: Record<string, string | number> = {}): string {
  return COPY[id].replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
