# ADR-15: shadcn/ui as the design language

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM

## Context
The UI needs a consistent, accessible, phone-first design system that a small team can own.

## Decision
Use **shadcn/ui** for the workflow maps and the UI build:
- Components (built on Radix UI and styled with Tailwind CSS) are copied into the repo, not installed as a closed library.
- Interaction maps name screen elements by their shadcn component, so a design maps directly to code.
- Default "neutral" theme with one accent colour. Light and dark mode follow the device setting.

## Consequences
- **Build-time packages are an access request under ADR-13**, to be listed with exact versions before UI coding starts: Tailwind CSS, Radix UI primitives, class-variance-authority, clsx, tailwind-merge, lucide-react, sonner, input-otp.
- Accessibility (keyboard use, focus handling, screen-reader labels) comes largely from Radix, but still needs testing.
- Process order (TPM): task map → workflow map → per-task interaction maps with final wording → build.
