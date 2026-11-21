// Field limits shared by the API, the web app and the database CHECK constraints.
// Source of truth: docs/GLOSSARY.md Part E (G1–G17) and docs/DATA_SCHEMA.md.
// If you change a value here, change the matching CHECK in a new migration.
export const LIMITS = {
  groupNameMax: 60, // G1
  groupCodeLength: 8, // G2
  displayNameMax: 30, // G4
  itemTitleMax: 100, // G6
  itemNotesMax: 500, // G7
  giversChoiceMaxLinks: 5, // G8
  exactProductLinks: 1,
  productDescriptionMax: 500, // G11
  linkNotesMax: 500,
  urlMax: 2000,
  pinMinDigits: 4, // exactly 4 (TPM UI review round 1)
  pinMaxDigits: 4,
  pinHintMax: 40, // G29
} as const;

// G2: group code alphabet without look-alike characters (no 0/O, 1/I/L).
export const GROUP_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
