# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** companies and training providers — HR / people teams, consultancies and training centers — who certify the employees or clients who completed a course, workshop or program, and then deliver those certificates by email.

Typical job: right after a training ends, take the attendee list exported from a spreadsheet, produce one correct certificate per person on the organization's own design, and get it to each person without manual, one-by-one work. The person doing it is usually an operations or HR coordinator, not a designer or developer.

Secondary (historic origin, still welcome): university organizers and educators issuing certificates for events and courses.

## Product Purpose

Uniautomate turns "a certificate design + a spreadsheet of people" into one finished PDF per person, and optionally saves each one to the organizer's Google Drive with a unique QR and emails it to its recipient. A second service sends personalized mass emails without certificates.

Success: a coordinator issues and delivers a full batch in minutes, with zero cut-off names, zero misaligned text and zero certificates sent to the wrong person.

## Positioning

- Works on the organization's **own** certificate design (PDF kept vector, up to 5 pages), not on a template gallery.
- Processing happens in the browser; lists are not stored on Uniautomate servers.
- Each certificate can carry a **unique QR** pointing to its own PDF in the organizer's Drive.
- Free today, no sign-up. Planned: accounts and history (Supabase) and a path toward an institutional product.

## Operating Context

- Input: a PDF/PNG/JPG certificate design (1–5 pages) and a CSV/XLSX/XLS/TXT list with names, emails and extra columns (course, date, ID…).
- Flow: 5-step wizard — template → fields & fonts → recipients → review → generate (ZIP, Google Drive, email).
- Output channels: ZIP download, Google Drive folder (OAuth `drive.file`), Gmail via a Vercel function (shared daily quota).
- Used on desktop primarily; must remain usable at 360 px.
- Interface language: Spanish (Latin America), "tú" form.

## Capabilities and Constraints

- Confirmed capabilities are described in `docs/04-historial-y-roadmap.md`.
- Privacy statements must stay accurate: emails pass through the Vercel function and Gmail; PDFs saved to Drive are link-shareable. Current landing copy claiming data "never leaves your computer" overstates this and must be corrected, not amplified.
- Open decisions: pricing, plans and account model (to be defined with the backend phase); own domain (currently `uniautomate.vercel.app`).

## Brand Commitments

- **Name:** Uniautomate (binding).
- **Brand color:** green `#208077` (binding).
- **Logo:** stacked-sheets-with-seal mark. Files: `public/favicon.svg` (icon), `public/brand/logo-claro.svg` (full logo for light backgrounds) and `public/brand/logo-oscuro.svg` (for dark backgrounds), rendered by `src/ui/BrandLogo.tsx` (binding).
- Voice: clear, direct, minimal text — the user has repeatedly asked for fewer words and less explanatory copy.
- Desired direction: a more corporate, professional feel suited to companies and training providers.

## Evidence on Hand

- Real product: live at https://uniautomate.vercel.app, with a public privacy policy at `/privacidad.html`.
- Sample certificate: `samples/certificado-3-paginas.pdf`.
- Creator contact: email and LinkedIn in the landing footer.
- **No** customers, testimonials, logos, usage metrics, press or case studies exist. Do not invent any.

## Product Principles

1. **Correct by construction:** prevent cut-off names, misalignment and wrong recipients before generating, not after.
2. **The organization's design is sacred:** never degrade the uploaded template (vector stays vector).
3. **Minimal words, obvious next step:** each screen has one clear primary action and little copy.
4. **Honest about data:** state exactly where data goes; never over-promise privacy.
5. **Professional trust:** the interface should feel credible enough for a company to send its certificates through it.

## Accessibility & Inclusion

Target WCAG 2.1 AA (keyboard, contrast, labels). Spanish-speaking users with low technical background.
