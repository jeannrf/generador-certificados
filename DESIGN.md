---
name: Uniautomate
description: Certificates for every training participant, issued from the organization's own design and spreadsheet.
colors:
  brand: "#208077"
  brand-deep: "#18655e"
  ink: "#0F2E2B"
  ink-muted: "#4B635F"
  paper: "#FFFFFF"
  wash: "#F4F8F7"
  table-head: "#E7F1EF"
  footer-text: "#B9D3CE"
typography:
  display:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(40px, 5vw, 64px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  display-tablet:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  heading-mobile:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Archivo, Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  certificate:
    fontFamily: "Playfair Display, Georgia, serif"
    fontWeight: 400
rounded:
  sheet: "6px"
  control: "6px"
spacing:
  row: "20px"
  section: "96px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.brand-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  table-header:
    backgroundColor: "{colors.table-head}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.footer-text}"
---

# Design System: Uniautomate

## Overview

**North star: the printed programme of a corporate training.** The public surface reads like the brochure a training center hands out: a cover, a contents table, a timetable and the certificate as the outcome. It speaks to HR and training coordinators who need to trust the tool with their organization's certificates (see PRODUCT.md).

Structure comes from ruled tables and a typographic grid, never from rows of identical cards. The one physical object on the page is the certificate sheet, shown with real-looking content and labelled as sample data.

Scope: this system is built on the landing (`src/features/landing/LandingPage.tsx`). The wizard and mailer screens still use the earlier Plus Jakarta Sans card UI; they inherit these colors and should move toward this system as they are rebuilt, not all at once.

## Colors

### Primary
- **Brand green `#208077`** (binding brand commitment): primary actions, the cover rule above the headline, link text, table labels. Hover deepens to `#18655e`.

### Neutral
- **Ink `#0F2E2B`**: all headings and body emphasis; also the footer field. A green-black, never pure black or slate.
- **Ink muted `#4B635F`**: body copy and captions on white.
- **Paper `#FFFFFF`**: the page ground (light: coordinators work at a desk in office light).
- **Wash `#F4F8F7`**: one alternating band (the timetable) to pace the scroll.
- **Table head `#E7F1EF`**: only for table header rows.

### Named Rules
- **One green.** Brand green is the only hue; everything else is ink, paper or a green-tinted neutral. No second accent, no gradients.
- **Tinted, never gray.** Secondary text and rules are mixed from ink (`ink/10`–`ink/25`), not from Tailwind slate.

## Typography

Archivo, a grotesque with a width axis, carries the whole page. Table labels use its condensed width (`font-stretch: 80%`) in uppercase with 0.08em tracking, the way a printed programme sets its column heads. Playfair Display appears **only inside the certificate sheet**, because it represents the customer's document, not the page's voice.

### Hierarchy
- Display (cover headline): 40/56/64px responsive, 700, line-height 1.02, tracking -0.03em, width 92%, balanced wrap.
- Section heading: 28–34px, 700, tracking -0.02em.
- Row title: 18px, 700.
- Body: 16–18px, 400, line-height ~1.6, measure ≤ 36rem.
- Label: 12px, 600, uppercase, 0.08em, condensed.

### Named Rules
- **No kickers.** Headings never carry an uppercase label above them. Labels live in tables, beside or below their row title.

## Layout

12-column grid inside a 1152px (`max-w-6xl`) container with 16/24px gutters. Sections pair a 4-column heading/intro with an 8-column ruled table. The cover splits 6/6: headline and actions left, certificate and spec sheet right. Section padding 80–96px; more space above a heading than below it. Sections are separated by 1px ink/10 rules, not by cards.

## Elevation & Depth

Flat. The single elevated object is the certificate sheet: `0 24px 48px -24px rgba(15,46,43,0.35), 0 2px 6px rgba(15,46,43,0.08)`. Tables use a 2px ink top rule and 1px ink/12 row rules. No shadows on buttons, rows or panels.

## Shapes

6px radius on controls, the timetable frame and the sheet. Nothing pill-shaped except icon-sized affordances. Hairline rules (1px) everywhere else.

## Components

### Buttons
- Primary: brand fill, white text, 6px radius, 12×20px, semibold 14px, optional trailing arrow icon. Focus: 2px brand ring with 2px offset.
- Secondary: white with ink/25 border; hover turns border and text brand green.
- Tertiary: brand-green text link with underline on hover (4px offset).

### Ruled table
Real `<table>` elements with `scope` headers and an `sr-only` caption. Header row in condensed uppercase labels (on `table-head` when framed, or above a 2px ink rule when open); rows separated by ink/12 hairlines. On mobile the table switches to `display: block` and each row stacks; the header row hides and stacked values get an inline label where meaning would be lost (e.g. "Obtienes:").

### Navigation
Sticky white header (95% opacity, light blur) with the full logo (`public/brand/logo-claro.svg`), four section links in ink-muted and a primary "Crear certificados" button (from `sm` up). Below `md` the links move into a disclosure menu (hamburger, 44px rows); below `sm` the header button hides because the cover CTA sits right under it.

### Closing band
The page ends on a `wash` band: cover rule, "Prueba con tu propio diseño." heading, one reassurance line and the primary button. The footer (ink field, `logo-oscuro.svg`) carries links and a separate "Soporte" row; footer links are 44px tall with a mint focus ring.

### Roster → certificate (signature component)
The cover's right column pairs a sample roster table (`#`, Nombre, Correo; `example.com` addresses) with the certificate generated for the active row. The active row gets the `wash` background and bold ink/brand text; clicking a name selects it and pauses the cycle.

The certificate is a 1.414:1 sheet sized entirely in container-query units (`cqw`) so it scales like a document: double brand-green frame, institute line in condensed caps, Playfair title and participant name, signature lines and a real vector QR from `QrPreview` (sample QRs point at the landing, never at a non-existent file). Every ~3.2s it re-issues to the next row (opacity + 3px blur swap, 300ms ease-out); long names step down in size to demonstrate auto-fit. Caption: "Certificado n de N · Datos de ejemplo" with a Pausar/Reanudar control (WCAG 2.2.2). Under `prefers-reduced-motion` it stays static and the control is hidden.

### Spec sheet
"Qué incluye" is a ruled `<dl>`: condensed uppercase brand-green labels (Plantilla, Campos, Nombres largos, QR, Correo, Reporte) beside plain ink values. Optional capabilities say "Opcional." first. It is the only place capabilities are listed; do not repeat them as cards elsewhere.

## Do's and Don'ts

### Do:
- Show the product's output (the certificate) instead of describing it.
- Use ruled tables for capabilities, steps and data handling.
- Label every illustrative value as sample data.
- State data handling exactly as it happens (browser, Gmail via server, organizer's Drive shared by link) and mark optional features as optional.

### Don't:
- Don't use eyebrow/kicker labels above headings.
- Don't build sections from rows of same-size icon cards.
- Don't show unverifiable metrics ("10x", "100% privado") or invent customers and testimonials.
- Don't introduce a second accent color, gradients or gradient text.
- Don't use Playfair or any serif outside the certificate sheet.
