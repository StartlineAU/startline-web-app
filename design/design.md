# Startline — Platform Design Playbook

A practical, decision-oriented guide for designing any Startline surface (athlete site, organiser portal, admin, decks, emails). It complements `readme.md` (the system's full spec) — this doc is the *how and when*. Companion: open `design-reference/index.html` for live specimens of everything below.

> **The one-line brief.** Startline is a **motorsport-grade instrument panel for fitness events** — fast, precise, competitive, trustworthy. Dark, near-black, one electric-lime accent. It must never read as a soft consumer app or look AI-generated.

---

## 1. Voice — how Startline writes
- **Athlete-first, second person.** "you", rarely "we". Imperative and action-led: *Find Your Start Line. · Register Now · Continue to payment.*
- **Short punchy fragments** for UI. Eyebrows/section titles are two-beat: *Trending Now / Most Popular Events*.
- **Australian English & locale.** Organiser (not organizer), state codes (NSW, VIC, QLD…), AUD (`$89`), 24h-ish times (`07:00 AM`).
- **UI chrome is UPPERCASE** with wide tracking — nav, labels, badges, buttons, meta, eyebrows. Author in normal case; the component uppercases.
- **Body copy is sentence case**, set in Inter, human and clear.
- **Numbers carry weight** — prices, dates, distances in bold-italic display type (`$89`, `14 SEP`, `120km`). State fees plainly: *Service fee (3.95% + $1.45)*.
- **No emoji, ever.** Line icons only.
- **Tone by surface:** athlete = motivational + confident; transactional (checkout, forms) = clear + reassuring (*You're In.*); organiser/admin = businesslike, efficient, dense.

---

## 2. Color — dark only, one accent
`color-scheme: dark` everywhere. There is **no light theme**. One accent — **signal green `#B3E153`** — does all the work; blue/amber/red appear *only* as status semantics. Restraint is the brand.

### Surfaces (step up as you nest)
| Token | Hex | Use |
|---|---|---|
| `--darker` | `#141414` | page background |
| `--dark` | `#1F1F1F` | raised surface — cards, panels, nav |
| `--dark-light` | `#2A2A2A` | input wells, subtle fills, icon chips |
| `--dark-lighter` | `#353535` | hairline borders, dividers, chips |

### Text
| Token | Hex | Use |
|---|---|---|
| `--light` | `#F5F7FA` | primary text, display |
| `--muted` | `#8A8F98` | secondary / meta |
| `--muted-dark` | `#6E737B` | tertiary / disabled |

### Accent & status
| Role | Fg | Surface |
|---|---|---|
| Brand / success / live | `#B3E153` | `rgb(179 225 83 / .10)` |
| Info / pending | `#60A5FA` | `rgb(96 165 250 / .12)` |
| Danger / rejected | `#F87171` | `rgb(248 113 113 / .12)` |
| Warning / draft | `#FBBF24` | `rgb(251 191 36 / .12)` |

**Rules of thumb**
- Green is precious. One accent per view, on the thing that matters (CTA, live status, the key number). Don't paint whole surfaces green.
- Status colors are *only* for status. Never decorate with blue/amber/red.
- Text on `#B3E153` is always `#141414` (dark ink), never white.
- On imagery, dim to ~55–62% brightness and lay a bottom-up near-black scrim so white/green stays legible.

---

## 3. Typography — two families, two moves
- **Chakra Petch** — everything structural: display, titles, nav, labels, buttons, badges, meta. Two signature treatments:
  - **Display / titles:** `700` **italic**, tight negative tracking (`-0.04em` hero, `-0.02em` titles). The "speed" gesture. (Chakra Petch tops out at 700 — "black" *is* 700; never synthesise heavier.)
  - **Labels / eyebrows / buttons / meta:** **UPPERCASE**, `700`/`500`, wide tracking (`0.15em`), small (10–12px).
- **Inter** — body/prose only: descriptions, help text, form values. Sentence case, line-height 1.5–1.65.

### Scale (px)
`eyebrow 10 · label 11 · meta 12 · sm 13 · body 15 · md 16 · lg 20 · xl 24 · 2xl 30 · 3xl 40 · 4xl 52 · display 88`

Never below **24px** on 1920×1080 slides; **12pt** minimum in print. Meta/eyebrow bottoms out at 10px and only in uppercase-wide.

---

## 4. Spacing & layout
- **4px base grid.** Prefer flex/grid with `gap` over margins.
- **Content rails:** listings/hero/detail cap **1440px**; header/portal inner rail **1200–1240px**; narrow flows (register, single-column forms) **600px**.
- Fixed top nav **56px**. Mobile hit targets **≥44px**.
- Generous vertical rhythm. Section blocks separated by 22–32px; card padding 22–26px.

---

## 5. Corners, borders, elevation
- **Corners are generous:** cards/inputs/buttons **12–14px**, media tiles **16px**, hero/search **24px**, pills/badges/avatars fully round.
- **Cards = raised dark surface (`#1F1F1F`) + 1px hairline (`#353535`), no drop shadow by default.** Interactive cards lift `-2px` and turn the border **green at 40%** on hover.
- **The "machined" shadow — the calling card.** A hard, blur-less green offset: `box-shadow: 2px 2px 0 #B3E153` on the primary CTA (lime gradient face). On hover button + shadow slide up-left to `4px 4px 0`; on press they snap flush. Use it on *the* primary action, sparingly.
- Soft ambient shadows (`0 4/8/20px …`) only for overlays, modals, dropdowns, hover-lifts.

---

## 6. Motion
Purposeful and quick. Easing `cubic-bezier(0.2,0.7,0.2,1)`, 150–300ms. Vocabulary: fades + short upward slides for entrances (`page-in`), modal scale/opacity in, a lime shimmer sweep on featured tiles, a pulsing "live" dot. Hover = lift + brighten; press = shrink/snap-flush. Always respect `prefers-reduced-motion`.

---

## 7. Textures (low-opacity lime on near-black)
Ship as helper classes; use to add HUD depth without noise.
- `.startline-scan-grid` — 40px lime grid at 5% (dashboards, hero overlays, key balance tiles).
- `.startline-hero-topo` — layered radial lime glows + diagonal contour hatching over a dark gradient (hero/command bands).
- `.startline-placeholder-stripes` — 45° stripes for empty/loading media.
Keep opacity low (≤50%). Never stack two textures on one element.

---

## 8. Iconography
**Lucide**, 2px stroke, round caps/joins, 24 viewBox, rendered 12–20px. Lime inside meta rows, `currentColor` elsewhere. Event-type taxonomy (CrossFit, Running, Hybrid, Swimming, Cycling, Triathlon…) is expressed as **text labels**, never icons. Never hand-draw bespoke icons; never emoji. Logo: checkered-flag mark + squared STARTLINE wordmark, white/green on dark, clear space around it, never recolor the flag.

---

## 9. Components

**Button** — machined primary (gradient + offset shadow), `outline` (hairline → green border on hover), `ghost` (muted → white on `white/5`), `lime` (solid), `destructive` (red surface → solid red on hover). Uppercase, 700, `0.12em` tracking. Heights 32/40/46.

**Badge / Status** — fully round pill, uppercase 10.5px `0.13em`. Optional 6px leading dot. Status uses the semantic surface/fg pairs from §2. Labels: Published · Pending · Draft · Rejected · Archived.

**Card** — `#1F1F1F` + `#353535` hairline, radius 14. Interactive → `-2px` lift + `primary/40` border + soft shadow. Optional `border-top: 2px` green accent for primary/summary cards.

**Input / Textarea** — well `#2A2A2A`, hairline border, radius 10–12, `focus` border → green. Placeholder `--muted-dark`. Label above: uppercase 10.5px `0.15em`.

**Top nav** — 56px, `rgb(20 20 20 / .92)` + blur, hairline bottom. Active link = `primary/14` bg + green text; idle = muted → white on `white/6`. Right cluster: notification bell (green count badge), avatar dropdown.

**Dropdown / Modal** — `#1F1F1F` (or `rgba(26,26,26,.98)` + blur), hairline, radius 12–18, soft `lg/xl` shadow. Modal overlay `rgb(10 10 10 / .7)` + subtle blur; content scales/fades in.

---

## 10. Page anatomy (the standard header)
Every top-level page opens the same way:
1. **Eyebrow** — uppercase `0.25em` green micro-label (2 words).
2. **Display headline** — Chakra Petch 700 italic `-0.04em`, often two lines with the **second line in green** (`Your race / calendar.`).
3. **Sub** — one Inter sentence, muted.
4. **Primary action** — right-aligned, bottom-aligned to the headline (machined button).

Then: stat tiles → primary content (table/cards) → secondary sections. Empty states center a muted icon chip + a 700-italic line + one muted sentence + a single CTA.

---

## 11. Data display — the decisions

**Table vs cards.** Default to a **table** for management/scan-heavy views (listings, payouts, registrations) — it's denser and sortable. Offer **cards** when imagery aids recognition or on smaller counts / touch contexts. Both share the same row data (thumb, italic title, pin-meta, status, count/cap, price). Keep one source of truth; switch presentation, not content.

**Density.** Comfortable (17px row padding) by default; Compact (12px) for power users with long lists. Font sizes stay; only padding changes.

**Status system.** Single source of truth object mapping `DRAFT/PENDING/APPROVED/REJECTED/ARCHIVED` → `{surface, fg, label}` per §2. Reuse it in badges, row rails, and filters. `APPROVED` renders as **"Published"** to the organiser.

**Capacity gauge.** `count/cap` as a thin rounded bar; thresholds **<70% green · 70–89% amber · ≥90% red**. Show inline in the count cell and enlarged on the event dashboard.

**Money.** AUD, integer dollars in summaries (`$229,654`), two-dp where precision matters. Always net-of-fees where a payout is implied, and say so (*after platform fees*).

---

## 12. Two design registers
Startline supports two on-brand registers. Pick one per surface; don't blend randomly.

**A. Product (clean).** The default. Straight page anatomy, flat dark cards, tables, restrained accent. Fast to read, calm, trustworthy. Use for the athlete site, forms, checkout, most organiser management, admin. This is the **retheme** register.

**B. Instrument / HUD.** The high-energy register for dashboards, launch moments, marketing, big-number summaries. Adds, *on top of A*:
- **Command band** — a hero panel on `.startline-hero-topo` + `.startline-scan-grid` overlay, wrapped in **corner brackets** (four 14px L-shapes, `primary/50`), with a segmented KPI strip of big italic numbers.
- **Status rails** — persistent 2px status-colored left border on table rows (not just hover).
- **Accent-topped tiles** — `border-top: 2px` green on primary stat cards; scan-grid behind the hero balance tile.
- **Corner brackets** reused on cover thumbs / logo tiles.
- **Machined CTAs** foregrounded.
Use B to signal "control room". Don't HUD-ify quiet transactional flows — it reads as noise there.

---

## 13. Theming rule — everything is dark
When a surface arrives light (legacy shadcn defaults, a new page scaffolded from a template), convert with this mapping rather than inventing values:

| Light | Dark |
|---|---|
| `bg-gray-50` (page) | `#141414` |
| white card | `#1F1F1F` + `#353535` border |
| `bg-gray-50` (header/well) | `white/[0.02]` or `#2A2A2A` |
| `bg-gray-100` (placeholder) | `#2A2A2A` |
| `text-gray-900` | `#F5F7FA` |
| `text-gray-700` | `white/70` |
| `text-gray-500` | `#8A8F98` |
| `text-gray-400` | `#6E737B` |
| `border-gray-200 / 100` | `#353535` / `white/5` |
| gray status badges | semantic surface/fg (§2) |
| `hover:bg-gray-50` | `hover:bg-white/5` |
| `hover:bg-lime-50` | `hover:bg-primary/5` |
| light spinner | `border-#353535 border-t-primary` |
Keep type treatment, layout, spacing and copy identical — theming changes appearance, not structure.

---

## 14. Do / Don't
**Do:** protect the one-accent rule · lead with numbers · uppercase-wide for chrome, sentence-case Inter for prose · dim imagery under scrims · use the machined shadow on *the* primary action · keep tables dense and honest · reuse the status object everywhere.

**Don't:** add a second brand hue · use status colors decoratively · put white text on green · use emoji or hand-drawn icons · stack textures or run them above 50% · gradient-wash backgrounds · round-corner-plus-left-accent-bar "card slop" · pad views with filler stats/sections · synthesise a heavier Chakra Petch weight · ship a light surface.

---

## Files
- `design-reference/index.html` — live specimens of §2–§12 (open in a browser; print-friendly).
- `readme.md` — full system spec + component/token index.
- `tokens/` — the CSS custom properties this doc names.
- `organiser-redesign/organiser.html` — worked example of both registers (Direction switch, bottom-center).
- `design_handoff_organiser_dark/` — file-by-file dev handoff applying §13 to the organiser pages.
