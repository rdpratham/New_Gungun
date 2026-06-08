# AI Outreach Agent

A single-file React artifact for an AI-powered outreach agent that runs entirely
inside claude.ai. No backend, no localStorage — all state lives in React `useState`.

## What it does

A 4-step wizard with a progress bar:

1. **Import contacts** — drag/drop or paste any format (CSV, Excel, JSON, plain
   text, business-card text, email signatures). Structured files are parsed
   locally with PapaParse / SheetJS; anything unstructured is sent to Claude to
   extract contacts into `{ name, email, company, role, linkedin_url }`. Inline
   editable table, add/delete rows, and a "Load sample data" button.
2. **Message templates** — email subject + body and a LinkedIn InMail body, with
   `{{name}}`, `{{company}}`, `{{role}}` variables, a tone selector, character
   counts (LinkedIn capped at 300), and live previews merged with the first
   contact.
3. **AI personalize** — Claude rewrites the templates per contact with a progress
   bar. Results show as editable cards (Email / LinkedIn tabs); edited cards turn
   green, and failed contacts get a retry button.
4. **Send** — metric cards (total / sent / pending / skipped), per-contact actions
   (Open in Outlook via `mailto:`, Copy LinkedIn, Open profile, Skip), a "Send all
   emails" loop, and CSV export of results.

## Model & libraries

- Anthropic API model: `claude-sonnet-4-20250514` (via the `callClaude` helper).
- [PapaParse](https://www.papaparse.com/) for CSV.
- [SheetJS / xlsx](https://sheetjs.com/) for Excel.
- [Tabler outline icons](https://tabler.io/icons) via CDN webfont.
- React hooks only — `useState`, `useCallback`, `useRef`, `useEffect`.

## Usage

`OutreachAgent.jsx` exports a default React component. Drop it into a React app
(or paste into a claude.ai React artifact) where `papaparse` and `xlsx` are
available. The Tabler icon stylesheet and component CSS are injected at runtime.

## Design notes

- Colors are driven by CSS variables and adapt to light/dark mode.
- Typography: h1 22px / h2 18px / body 16px, font-weight never above 500,
  sentence case throughout.
- No gradients, no shadows, cards with 0.5px borders and 12px radius.
- Responsive — columns stack on narrow widths.
