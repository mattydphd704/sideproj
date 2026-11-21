// Workflow scenarios for the clickable prototype (Section 1: Getting in).
// Global rules (docs/UI_INTERACTION_MAPS.md §1.00): every scenario is a path through the one
// flow map (GR-1) and uses the same Smith Family data (GR-8). Scenarios differ only in how
// the person arrives and what this browser already knows.
import { addGroup, getState, newState, setState } from "./mockServer";

export type Workflow = "Joining a group" | "Signing back in" | "Starting a new group" | "Mistakes and limits";

/** The setup and sign-in workflows in scope for Section 1, in the order shown. */
export const WORKFLOWS: Workflow[] = ["Joining a group", "Signing back in", "Starting a new group", "Mistakes and limits"];

/** The screens of the Getting-in flow (GR-1). Global changes are tied to one of these, or to all. */
export type ScreenKey = "home" | "join" | "new" | "group";
export const SCREEN_LABEL: Record<ScreenKey | "all", string> = {
  home: "Home", join: "Join (choose your name, PIN)", new: "Start a group / Waiting", group: "Inside the group", all: "Every screen",
};

export type Scenario = {
  id: string;
  workflow: Workflow;
  /** Screens this scenario passes through, so global changes show up wherever they apply. */
  screens: ScreenKey[];
  title: string;
  tasks: string[];
  who: string;
  /** How the person arrives (an entry point on the GR-1 map). */
  arrives: string;
  /** What this browser already knows before the scenario starts. */
  browser: string;
  start: string;
  testData: [string, string][];
  steps: string[];
  outcome: string;
  /** Shows the organiser's Approve and Decline buttons in the side panel. */
  organiser?: boolean;
  setup?: () => void;
};

export const GROUP_CODE = "SMTH-2345";

/** GR-8: the one group every scenario uses. */
export const SHARED_DATA: { name: string; state: string; pin: string; hint: string }[] = [
  { name: "Sam", state: "Joined", pin: "1234", hint: "the old house number" },
  { name: "Alex", state: "Joined", pin: "1234", hint: "none" },
  { name: "Jo", state: "Joined", pin: "2580", hint: "the garden gate" },
  { name: "Grandma", state: "Added, not signed in yet", pin: "—", hint: "—" },
  { name: "Uncle Ray", state: "Added, not signed in yet", pin: "—", hint: "—" },
];

function sharedGroup() {
  return addGroup("Smith Family", GROUP_CODE.replace("-", ""), SHARED_DATA.map((m) =>
    m.state === "Joined"
      ? { name: m.name, pin: m.pin, hint: m.hint === "none" ? null : m.hint }
      : { name: m.name, status: "pending" as const }));
}

// Steps shared by every "join as a new person" path, so they read the same everywhere.
const NEW_PERSON_STEPS = (name: string) => [
  `In "Have you already been added?", choose "No, I'm new here". The "Your name" box appears.`,
  `Type "${name}".`,
  "Create a PIN: 4 numbers. The numbers show as you type.",
  "Enter the same PIN again. As soon as the 4th number is typed, you see \"PINs match.\"",
  "Optionally add a PIN hint, then tap \"Join Smith Family\".",
];

export const SCENARIOS: Scenario[] = [
  {
    id: "SC-01", workflow: "Joining a group", title: "Join from an invite link", tasks: ["T-01", "T-03"],
    screens: ["join", "group"],
    who: "Morgan, a cousin who has never used the app",
    arrives: "Taps the invite link Sam texted them",
    browser: "New: has never used the app",
    start: `/j/${GROUP_CODE}`,
    testData: [["Your name", "Morgan"], ["PIN", "any 4 numbers, typed twice"]],
    steps: ["The Join screen opens: \"Join Smith Family\", with who's already here. The dropdown lists everyone in the group.", ...NEW_PERSON_STEPS("Morgan")],
    outcome: "Morgan is inside Smith Family, with \"Welcome to Smith Family!\" and \"Signed in as Morgan\".",
  },
  {
    id: "SC-02", workflow: "Joining a group", title: "Type a group code", tasks: ["T-02", "T-03"],
    screens: ["home", "join", "group"],
    who: "Pat, who was told the code out loud",
    arrives: "Opens the app's home page and types the code",
    browser: "New: has never used the app",
    start: "/",
    testData: [["Wrong code to try first", "ABCD-EFGH"], ["Right code", GROUP_CODE], ["Your name", "Pat"]],
    steps: [
      "Home shows one box: Group code.",
      "Type the wrong code and tap Continue. \"That group code didn't work…\" appears under the box.",
      "Type the right code (with or without the dash, any case) and tap Continue.",
      "The same Join screen as SC-01 opens.",
      ...NEW_PERSON_STEPS("Pat"),
    ],
    outcome: "Pat is inside Smith Family, with \"Welcome to Smith Family!\".",
  },
  {
    id: "SC-03", workflow: "Joining a group", title: "Join under a name the organiser added", tasks: ["T-04"],
    screens: ["join", "group"],
    who: "Grandma, whom the organiser added before she ever opened the app",
    arrives: "Taps the invite link her grandson sent",
    browser: "New: has never used the app",
    start: `/j/${GROUP_CODE}`,
    testData: [["Have you already been added?", "Grandma"], ["PIN", "any 4 numbers, typed twice"]],
    steps: [
      "The same Join screen as SC-01 opens.",
      "Open \"Have you already been added?\". It lists everyone in the group (Alex, Grandma, Jo, Sam, Uncle Ray), then \"No, I'm new here\".",
      "Choose Grandma. Because she hasn't signed in before, \"Create a PIN\" appears (no \"Your name\" box, since the name is set).",
      "Create a PIN, then enter it again. \"PINs match.\" appears.",
      "Optionally add a PIN hint, then tap \"Join Smith Family\".",
    ],
    outcome: "Grandma is inside Smith Family as \"Signed in as Grandma\". From now on, choosing Grandma asks for her PIN instead of creating one.",
  },
  {
    id: "SC-04", workflow: "Mistakes and limits", title: "Same name as someone already in the group", tasks: ["T-03", "T-05"],
    screens: ["join", "group"],
    who: "A second Alex: a new friend of the family, not the Alex who's already in the group",
    arrives: "Taps the invite link",
    browser: "New: has never used the app",
    start: `/j/${GROUP_CODE}`,
    testData: [["Name they pick first", "Alex (the other Alex)"], ["A PIN they try", "any 4 numbers except 1234"], ["Name they end up with", "Alex B"]],
    steps: [
      "The same Join screen as SC-01 opens. In \"Have you already been added?\", choose Alex, thinking it's them.",
      "\"Enter your PIN\" appears. Enter any 4 numbers and tap Sign in.",
      "\"That PIN didn't match…\" appears, with two buttons: \"I don't have a PIN yet\" and \"I can't remember my PIN\".",
      "Tap \"I don't have a PIN yet\". It explains they're probably a different Alex and suggests a name like \"Alex B\".",
      "Tap \"Use a different name\". The dropdown switches to \"No, I'm new here\".",
      "Type \"Alex B\", create a PIN, enter it again, and tap \"Join Smith Family\".",
    ],
    outcome: "The second Alex joins as \"Alex B\" with \"Welcome to Smith Family!\". The original Alex is untouched.",
  },
  {
    id: "SC-05", workflow: "Signing back in", title: "Sign back in on a new device, using the hint", tasks: ["T-05", "S-04"],
    screens: ["join", "group"],
    who: "Jo, who joined before but cleared their browser and can't quite remember their PIN",
    arrives: "Taps the invite link",
    browser: "Cleared: the app no longer recognises Jo",
    start: `/j/${GROUP_CODE}`,
    testData: [["Your name", "Jo"], ["Jo's hint", "the garden gate"], ["Jo's PIN", "2580"]],
    steps: [
      "The same Join screen as SC-01 opens. In \"Have you already been added?\", choose Jo.",
      "Because Jo has signed in before, only \"Enter your PIN\" appears (no new PIN to create).",
      "Tap \"Show my hint\". It says \"Your hint: the garden gate\".",
      "Enter 2580 and tap Sign in.",
    ],
    outcome: "Jo is back in Smith Family with \"Welcome back, Jo!\".",
  },
  {
    id: "SC-06", workflow: "Signing back in", title: "Wrong PIN, then too many wrong PINs", tasks: ["T-05", "S-02"],
    screens: ["join"],
    who: "Sam, who has forgotten their PIN (or someone trying to guess it)",
    arrives: "Taps the invite link",
    browser: "New: the app doesn't know them",
    start: `/j/${GROUP_CODE}`,
    testData: [["Your name", "Sam"], ["Wrong PIN", "0000 (5 times)"]],
    steps: [
      "In \"Have you already been added?\", choose Sam. \"Enter your PIN\" appears.",
      "Enter 0000 and tap Sign in. \"That PIN didn't match…\" appears, with \"I don't have a PIN yet\" and \"I can't remember my PIN\".",
      "Tap \"I can't remember my PIN\". Sam's hint is shown, with \"Forgot your PIN? Ask the group organiser to reset it.\"",
      "Enter 0000 again until the 5th wrong try.",
    ],
    outcome: "A red \"Too many wrong PINs\" alert appears above the card, saying Sam is locked until a time 15 minutes away. Sign in is greyed out.",
  },
  {
    id: "SC-13", workflow: "Signing back in", title: "Types their name instead of choosing it", tasks: ["T-05"],
    screens: ["join", "group"],
    who: "Alex (the original), on a new phone, who doesn't notice their name in the list",
    arrives: "Taps the invite link",
    browser: "New phone: the app doesn't know Alex here",
    start: `/j/${GROUP_CODE}`,
    testData: [["Your name", "Alex"], ["Alex's PIN", "1234"]],
    steps: [
      "Choose \"No, I'm new here\" and type \"Alex\".",
      "As soon as you leave the name box (or tap Join), it asks \"There's already someone called Alex in Smith Family. Is that you?\"",
      "Tap \"Yes, that's me\". The dropdown switches to Alex and \"Enter your PIN\" appears.",
      "Enter 1234 and tap Sign in.",
    ],
    outcome: "Alex is back in Smith Family with \"Welcome back, Alex!\". (\"No, I'm a different Alex\" would instead ask for a name like \"Alex B\", as in SC-04.)",
  },
  {
    id: "SC-09", workflow: "Starting a new group", title: "Start a new group (approved)", tasks: ["T-06", "T-07"],
    screens: ["home", "new", "group"],
    who: "Rosa, who wants a group for her side of the family",
    arrives: "Opens the app's home page and taps \"Start a new group\"",
    browser: "New: has never used the app",
    start: "/", organiser: true,
    testData: [["Group name", "Garcia Family"], ["Your name", "Rosa"], ["PIN", "any 4 numbers, typed twice"]],
    steps: [
      "Tap \"Start a new group\". Fill in Group name (currency is pre-chosen from your region).",
      "Fill in \"Your name\" and the PIN block. These are the same fields and checks as the Join screen, including \"PINs match.\".",
      "Tap \"Send request\". The Waiting for approval screen appears.",
      "Play the organiser: in this panel, tap \"Approve request\".",
      "Back in the phone, tap \"Check now\" (the real app also checks by itself every 30 seconds).",
    ],
    outcome: "Rosa is moved into Garcia Family automatically, with \"\"Garcia Family\" is ready. Welcome!\".",
  },
  {
    id: "SC-10", workflow: "Starting a new group", title: "Start a new group (declined)", tasks: ["T-06", "T-08"],
    screens: ["home", "new"],
    who: "Max, whose request the organiser turns down",
    arrives: "Opens the app's home page and taps \"Start a new group\"",
    browser: "New: has never used the app",
    start: "/", organiser: true,
    testData: [["Group name", "Max's Mates"], ["Your name", "Max"]],
    steps: [
      "Tap \"Start a new group\", fill in the form the same way as SC-09, and tap \"Send request\".",
      "Play the organiser: tap \"Decline request\" in this panel.",
      "Tap \"Check now\" in the phone.",
      "Tap \"Send a new request\".",
    ],
    outcome: "\"Your request wasn't approved\" appears, and \"Send a new request\" brings back an empty Start a new group form.",
  },
  {
    id: "SC-07", workflow: "Mistakes and limits", title: "PIN typo while joining", tasks: ["T-03"],
    screens: ["join"],
    who: "Robin, typing quickly",
    arrives: "Taps the invite link",
    browser: "New: has never used the app",
    start: `/j/${GROUP_CODE}`,
    testData: [["Your name", "Robin"], ["Create a PIN", "1234"], ["Enter your PIN again", "9999"]],
    steps: [
      ...NEW_PERSON_STEPS("Robin").slice(0, 3),
      "In \"Enter your PIN again\", type 9999. As soon as the 4th number is typed, \"The two PINs don't match. Try again.\" appears.",
      "Fix the second PIN to 1234. The message changes to \"PINs match.\".",
    ],
    outcome: "The mismatch shows the moment it happens and clears when fixed. Nothing is sent until the PINs match.",
  },
  {
    id: "SC-08", workflow: "Mistakes and limits", title: "Broken invite link", tasks: ["T-01"],
    screens: ["join", "home"],
    who: "Lee, whose link got cut off when it was copied",
    arrives: "Taps a link with a wrong code",
    browser: "New: has never used the app",
    start: "/j/ABCD-EFGH",
    testData: [["Link opened", "/j/ABCD-EFGH (no such group)"], ["Right code", GROUP_CODE]],
    steps: [
      "\"This invite didn't work\" appears, with an \"Enter a code\" button.",
      "Tap \"Enter a code\". Home opens.",
      "Type the right code and tap Continue.",
    ],
    outcome: "Lee reaches the same Join screen as SC-01.",
  },
  {
    id: "SC-12", workflow: "Mistakes and limits", title: "Too many attempts from one network", tasks: ["S-03"],
    screens: ["home"],
    who: "Someone trying lots of codes from one network",
    arrives: "Opens the app's home page",
    browser: "This network already made 10 failed attempts in the last 15 minutes",
    start: "/",
    testData: [["Any code", "e.g. ABCD-EFGH"]],
    steps: ["Type any code and tap Continue."],
    outcome: "A red alert above the card says \"Too many attempts. Please wait 15 minutes and try again.\", and Continue is greyed out.",
    setup: () => { getState().ipFailures = 10; },
  },
];

/** Scenarios in display order: grouped by workflow. */
export const ORDERED: Scenario[] = WORKFLOWS.flatMap((w) => SCENARIOS.filter((s) => s.workflow === w));

/** Fresh pretend server and browser for a scenario, always starting from the shared data (GR-8). */
export function prepare(sc: Scenario) {
  setState(newState());
  try { localStorage.removeItem("lastGroup"); } catch {}
  sharedGroup();
  sc.setup?.();
}
