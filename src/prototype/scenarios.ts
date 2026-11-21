// Workflow scenarios for the clickable prototype (Section 1: Getting in).
// Each one maps to tasks in docs/UI_TASK_MAP.md and screens in docs/UI_INTERACTION_MAPS.md.
import { addGroup, getState, newState, setState } from "./mockServer";

export type Workflow = "Joining a group" | "Signing back in" | "Starting a new group" | "Mistakes and limits";

/** The setup and sign-in workflows in scope for Section 1, in the order shown. */
export const WORKFLOWS: Workflow[] = ["Joining a group", "Signing back in", "Starting a new group", "Mistakes and limits"];

export type Scenario = {
  id: string;
  workflow: Workflow;
  title: string;
  tasks: string[];
  who: string;
  trigger: string;
  start: string;
  testData: [string, string][];
  steps: string[];
  outcome: string;
  /** Shows the organiser's Approve and Decline buttons in the side panel. */
  organiser?: boolean;
  setup: () => void;
};

const SMITH = "SMTH2345";
const SMITH_SHOWN = "SMTH-2345";

/** The Smith Family group used by most scenarios. */
function smith(extra: { pending?: string[] } = {}) {
  return addGroup("Smith Family", SMITH, [
    { name: "Sam", pin: "1234", hint: "the old house number" },
    { name: "Alex", pin: "1234" },
    { name: "Jo", pin: "2580", hint: "the garden gate" },
    ...(extra.pending ?? []).map((name) => ({ name, status: "pending" as const })),
  ]);
}

export const SCENARIOS: Scenario[] = [
  {
    id: "SC-01",
    workflow: "Joining a group",
    title: "Join from an invite link",
    tasks: ["T-01", "T-03"],
    who: "Morgan, a cousin who has never used the app",
    trigger: "Sam texts Morgan the family's invite link, and Morgan taps it on their phone.",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Invite link", `/j/${SMITH_SHOWN}`], ["Your name", "Morgan"], ["PIN", "any 4 numbers, typed twice"]],
    steps: [
      "The Join screen opens for \"Smith Family\" and lists who's already here.",
      "Leave \"Have you already been added?\" alone and type a name.",
      "Create a 4-number PIN. The numbers show as you type.",
      "Enter the same PIN again. A hint is optional.",
      "Tap \"Join Smith Family\".",
    ],
    outcome: "Morgan is inside Smith Family, sees \"Welcome to Smith Family!\" and \"Signed in as Morgan\".",
    setup: () => { smith({ pending: ["Grandma"] }); },
  },
  {
    id: "SC-02",
    workflow: "Joining a group",
    title: "Type a group code",
    tasks: ["T-02"],
    who: "Pat, who was told the code out loud",
    trigger: "At a family dinner Sam says \"our code is SMTH-2345\". Pat opens the app's home page.",
    start: "/",
    testData: [["Wrong code to try first", "ABCD-EFGH"], ["Right code", SMITH_SHOWN]],
    steps: [
      "Home shows one box: Group code.",
      "Type a wrong code and tap Continue. An error appears under the box.",
      "Type the right code (with or without the dash, any case) and tap Continue.",
    ],
    outcome: "The Join screen for Smith Family opens. From here it's the same as SC-01.",
    setup: () => { smith(); },
  },
  {
    id: "SC-03",
    workflow: "Joining a group",
    title: "Join under a name the organiser added",
    tasks: ["T-04"],
    who: "Grandma, whom the organiser added by name before she ever opened the app",
    trigger: "Grandma opens the invite link her grandson sent.",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Have you already been added?", "Grandma"], ["PIN", "any 4 numbers"]],
    steps: [
      "Open \"Have you already been added?\". Only people who haven't signed in yet are listed (Grandma, Uncle Ray), plus \"No, I'm new here\".",
      "Choose Grandma. The \"Your name\" box disappears because the name is set.",
      "Create a PIN, enter it again, and optionally add a hint.",
      "Tap \"Join Smith Family\".",
    ],
    outcome: "Grandma is inside the group. If you restart this scenario, her name is gone from the dropdown because she has now signed in.",
    setup: () => { smith({ pending: ["Grandma", "Uncle Ray"] }); },
  },
  {
    id: "SC-04",
    workflow: "Signing back in",
    title: "Name already taken, so sign back in",
    tasks: ["T-03", "T-05"],
    who: "Alex, who joined last year, on a new phone",
    trigger: "Alex opens the invite link on a new phone and tries to join again as \"Alex\".",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Your name", "Alex"], ["Alex's real PIN", "1234"]],
    steps: [
      "Type \"Alex\", create any PIN twice, and tap Join.",
      "An error says the name is taken, with a \"Sign back in\" link.",
      "Tap \"Sign back in\". The Welcome back screen opens.",
      "Choose Alex, enter 1234, and tap Sign in.",
    ],
    outcome: "Alex is back in the group with \"Welcome back, Alex!\", and their list and claims are intact.",
    setup: () => { smith(); },
  },
  {
    id: "SC-05",
    workflow: "Signing back in",
    title: "Sign back in on a new device, using the hint",
    tasks: ["T-05", "S-04"],
    who: "Jo, who cleared their browser and can't quite remember their PIN",
    trigger: "The app no longer recognises Jo's browser. Jo opens the invite link and taps \"Been here before? Sign back in\".",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Your name", "Jo"], ["Jo's hint", "the garden gate"], ["Jo's PIN", "2580"]],
    steps: [
      "On the Join screen, tap \"Been here before? Sign back in\".",
      "Choose Jo from the list. A \"Show my hint\" link appears.",
      "Tap \"Show my hint\". It says \"Your hint: the garden gate\".",
      "Enter 2580 and tap Sign in.",
    ],
    outcome: "Jo is back in the group with \"Welcome back, Jo!\".",
    setup: () => { smith(); },
  },
  {
    id: "SC-06",
    workflow: "Signing back in",
    title: "Too many wrong PINs",
    tasks: ["T-05", "S-02"],
    who: "Someone trying to guess Sam's PIN (or Sam, having a bad day)",
    trigger: "On Welcome back, the person keeps entering the wrong PIN for Sam.",
    start: `/j/${SMITH_SHOWN}/back`,
    testData: [["Your name", "Sam"], ["Wrong PIN", "0000 (5 times)"]],
    steps: [
      "Choose Sam, enter 0000, and tap Sign in. The wrong-PIN message mentions the 5-try limit.",
      "Repeat until the 5th wrong try.",
    ],
    outcome: "A red \"Too many wrong PINs\" alert says Sam is locked until a time 15 minutes from now. Sign in is greyed out.",
    setup: () => { smith(); },
  },
  {
    id: "SC-07",
    workflow: "Mistakes and limits",
    title: "PIN typo while joining",
    tasks: ["T-03"],
    who: "Robin, typing quickly",
    trigger: "While joining, Robin types one PIN and then a different one in \"Enter your PIN again\".",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Your name", "Robin"], ["Create a PIN", "1234"], ["Enter your PIN again", "9999"]],
    steps: [
      "Type a name, enter 1234, then 9999 in the second PIN boxes.",
      "Tap Join.",
    ],
    outcome: "\"The two PINs don't match. Try again.\" appears, the second boxes clear, and nothing is sent.",
    setup: () => { smith(); },
  },
  {
    id: "SC-08",
    workflow: "Mistakes and limits",
    title: "Broken invite link",
    tasks: ["T-01"],
    who: "Lee, who received a link that got cut off when it was copied",
    trigger: "Lee taps a link whose code is wrong.",
    start: "/j/ABCD-EFGH",
    testData: [["Link opened", "/j/ABCD-EFGH (no such group)"], ["Right code", SMITH_SHOWN]],
    steps: [
      "\"This invite didn't work\" appears, with an \"Enter a code\" button.",
      "Tap \"Enter a code\". Home opens.",
      "Type the right code and continue.",
    ],
    outcome: "Lee reaches the Join screen for Smith Family.",
    setup: () => { smith(); },
  },
  {
    id: "SC-09",
    workflow: "Starting a new group",
    title: "Start a new group (approved)",
    tasks: ["T-06", "T-07"],
    who: "Rosa, who wants a group for her side of the family",
    trigger: "Rosa opens the app with no code and taps \"Start a new group\".",
    start: "/",
    organiser: true,
    testData: [["Group name", "Garcia Family"], ["Your name", "Rosa"], ["PIN", "any 4 numbers, twice"]],
    steps: [
      "Tap \"Start a new group\" and fill in the form (currency is pre-chosen from your region).",
      "Tap \"Send request\". The Waiting for approval screen appears.",
      "Play the organiser: in this panel, tap \"Approve request\".",
      "Back in the phone, tap \"Check now\" (the real app also checks by itself every 30 seconds).",
    ],
    outcome: "Rosa is moved into Garcia Family automatically, with \"\"Garcia Family\" is ready. Welcome!\".",
    setup: () => {},
  },
  {
    id: "SC-10",
    workflow: "Starting a new group",
    title: "Start a new group (declined)",
    tasks: ["T-06", "T-08"],
    who: "Max, whose request the organiser turns down",
    trigger: "Max asks for a group, and the organiser declines it.",
    start: "/new",
    organiser: true,
    testData: [["Group name", "Max's Mates"], ["Your name", "Max"]],
    steps: [
      "Fill in the form and tap \"Send request\".",
      "Play the organiser: tap \"Decline request\" in this panel.",
      "Tap \"Check now\" in the phone.",
      "Tap \"Send a new request\".",
    ],
    outcome: "The declined message appears, and \"Send a new request\" brings back an empty form.",
    setup: () => {},
  },
  {
    id: "SC-11",
    workflow: "Joining a group",
    title: "Open an invite link when already in the group",
    tasks: ["T-01"],
    who: "Sam, already signed in on this phone",
    trigger: "Sam taps the group's invite link again, perhaps from an old message.",
    start: `/j/${SMITH_SHOWN}`,
    testData: [["Browser", "already signed in as Sam"]],
    steps: ["Nothing to do. Watch what happens when the link opens."],
    outcome: "Sam goes straight into the group, with \"You're already in Smith Family.\" No join form.",
    setup: () => {
      const g = smith();
      getState().browser.memberIds.push(g.members.find((m) => m.name === "Sam")!.id);
    },
  },
  {
    id: "SC-12",
    workflow: "Mistakes and limits",
    title: "Too many attempts from one network",
    tasks: ["S-03"],
    who: "Someone trying lots of codes from one network",
    trigger: "This network has already made 10 failed attempts in the last 15 minutes.",
    start: "/",
    testData: [["Any code", "e.g. ABCD-EFGH"]],
    steps: ["Type any code and tap Continue."],
    outcome: "A red alert says \"Too many attempts. Please wait 15 minutes and try again.\", and Continue is disabled.",
    setup: () => { smith(); getState().ipFailures = 10; },
  },
];

/** Scenarios in display order: grouped by workflow. */
export const ORDERED: Scenario[] = WORKFLOWS.flatMap((w) => SCENARIOS.filter((s) => s.workflow === w));

/** Fresh pretend server and browser for a scenario. */
export function prepare(sc: Scenario) {
  setState(newState());
  try { localStorage.removeItem("lastGroup"); } catch {}
  sc.setup();
}
