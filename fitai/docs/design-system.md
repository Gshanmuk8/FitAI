# FitAI Design System — "Signal"

The design language is called **Signal**: every pixel either carries
information about the user's body and progress, or it gets out of the way.
This document is the source of truth; `client/src/styles/*` implements it
in code, token-for-token.

---

## 1. Design philosophy (first principles)

1. **The data is the decoration.** A fitness coach earns trust by showing
   evidence — pace, streaks, trends — not stock photos of athletes. So the
   most visually rich elements are the numbers themselves (a dedicated
   numeric font, progress bars, heat strips), and everything else is quiet
   graphite. This is why there are no hero images and no illustration set.
2. **Dark-first, because the product lives at 6am and 10pm.** Users check
   the app pre-workout and pre-sleep. Deep near-black (#0B0B0C, never pure
   black — pure black makes OLED smearing and border contrast worse)
   reduces glare and makes the accent signals read like instrumentation.
3. **One accent = one meaning.** Color is a semantic channel, not a mood
   board: emerald = on track / complete, amber = attention / behind,
   red = risk / destructive, electric blue = interactive / brand, cyan =
   AI presence. A color never means two things. This is the single biggest
   defense against "noisy gym app."
4. **Motion states facts.** Animation exists to explain state change
   (something appeared, completed, failed) — 120–320ms, one easing curve,
   no idle loops. If a transition doesn't communicate causality, cut it.
5. **The AI is a colleague, not a mascot.** No avatars, no sparkle emoji
   spray. The AI's presence is typographic (cyan tint, monospaced
   confidence readouts, visible "thinking" state) — closer to a cockpit
   than a chatbot toy.

Cultural fusion, deliberately: Singaporean efficiency (dense but ordered
dashboards, zero decorative screens), American product-led hierarchy (one
primary action per screen, bold section headers), Korean card elegance
(soft 12–16px radii, smooth 200ms transitions, generous type contrast),
British editorial restraint (wide measure, calm copy, real punctuation),
Russian geometric confidence (hard grid, tall condensed-feel display type,
unapologetic black).

## 2. Brand identity

- **Name mark:** "FitAI" set in Space Grotesk 700, tracking -2%, with the
  "AI" in electric blue. No logo glyph needed at this stage; the wordmark
  + the signal-color system *is* the identity.
- **Voice:** precise, encouraging, never cute. "Behind plan by 1.2kg —
  tighten adherence this week," not "Oops! Let's crush it! 💪".
- **Recognizability test:** a screenshot with the logo cropped out should
  still be identifiable by (a) graphite surfaces + one semantic accent,
  (b) monospaced numerals, (c) the left-accent-bar card.

## 3. Typography

| Role | Font | Why |
|---|---|---|
| Display / headings | **Space Grotesk** | Geometric with quirky terminals — futuristic without being sci-fi cosplay; distinct from Inter-everywhere apps |
| Body / UI | **Inter** | The best screen humanist at small sizes; boring on purpose — body text should never compete with data |
| Numbers / data / AI meta | **JetBrains Mono** | Tabular digits align in stat grids; monospace signals "measured, not marketed" — the brand's trust cue |

Fallbacks: `system-ui` stack. Scale (rem, 1.25 ratio, base 16): 12 caption
/ 14 body-s / 16 body / 20 h3 / 25 h2 / 31 h1 / 39 display. Line-height:
1.5 body, 1.2 headings, 1.0 stat values. Weights: 400/500/700 only.

## 4. Color tokens

Dark (default) — all pairs meet WCAG AA on their surfaces:

```
--bg0 #0B0B0C   app background        --text    #F2F5F7  primary text
--bg1 #121216   page wells            --muted   #9AA1B0  secondary text
--surface  #17171C  cards             --faint   #6A7080  tertiary/labels
--surface2 #1E1E25  nested/hover      --border  rgba(255,255,255,.08)
                                      --border2 rgba(255,255,255,.16)
--blue    #4D9FFF  interactive/brand  --cyan   #35D6E5  AI presence
--emerald #34C97D  success/on-track   --lime   #C5EF45  streak/energy
--amber   #FFB224  warning/behind     --red    #F2555A  danger/risk
```

Light mode inverts surfaces (#F7F8FA bg, #FFFFFF cards, #16181D text) and
*darkens* the accents one step (e.g. emerald #1F9D5E) to keep AA contrast.
Accents never change meaning between modes. Gradients: exactly one
(blue→cyan), reserved for the brand mark and primary-button hover sheen.

Token naming: `--{category}-{name}[-{state}]` in CSS; in Figma:
`color/bg/0`, `color/accent/emerald`, `type/display/lg`, `space/4`,
`radius/md`, `elev/1`, `motion/normal`. Never name tokens by usage-of-the-
week ("card-title-color") — name by role.

## 5. Space, radius, elevation, grid

- **Spacing:** 4px base — 4/8/12/16/24/32/48/64. Nothing off-scale.
- **Radius:** 6 (inputs, chips) / 10 (buttons) / 14 (cards) / 999 (pills).
- **Grid:** content max-widths 560 (forms), 720 (reading), 960 (dash),
  1200 (analytics); 24px page gutters, 16px card gutters; card grids are
  `auto-fit minmax(240px, 1fr)`.
- **Elevation:** dark mode elevates by *lightening surface + border*, not
  shadows (shadows are invisible on #0B0B0C): level 0 = surface, 1 =
  surface2 + border2, 2 (modals) = surface2 + 24px blur backdrop dim.
  Light mode uses true shadows: `0 1px 2px rgba(16,24,40,.06)` and
  `0 8px 24px rgba(16,24,40,.10)`.
- **Glass:** backdrop-blur only on the sticky nav and modal scrims — the
  two places content genuinely passes beneath. Nowhere else.

## 6. Iconography

Stroke icons, 1.75px stroke, 24px grid, rounded caps with geometric
skeletons (circles/rects underneath). Until a custom set is cut, use
outlined glyphs at consistent optical size; never mix filled and outlined
in one surface. Emoji only in achievement contexts (🏅 / 🔥) where warmth
is the point.

## 7. Motion

- Durations: `--fast 120ms` (hover, press), `--normal 200ms` (reveal,
  card enter), `--slow 320ms` (page transitions, progress fills).
- Easing: single curve `cubic-bezier(.2,.8,.2,1)` (confident start, soft
  landing). Progress bars fill left→right on mount (320ms) — data arrival
  is an event worth staging.
- Page enter: 8px rise + fade, 200ms. Checklist completion: check scales
  1→1.15→1 (120ms) + row tint fades to emerald 8%. No confetti — the
  "reward" is the streak count ticking up in lime.
- Skeletons: shimmering surface2 blocks, only for content that takes >300ms.
- Respect `prefers-reduced-motion`: all transforms collapse to opacity.

## 8. Components (canonical states)

**Nav** — sticky glass bar, wordmark left, links with active pill
(surface2 + text). Mobile: same bar wraps; bottom-nav is a future PWA step.
**Card** — surface, 14px radius, 1px border; hover: border2 + 2px lift
(only when clickable). Accent variant: 3px left bar in a semantic color —
the signature FitAI element (pace card, adaptation notices, AI cards).
**Stat tile** — faint 12px label, 25px JetBrains Mono value, 12px muted
sub. Numbers always mono, always tabular.
**Buttons** — primary (blue, white text), ghost (transparent, border),
danger (red). 10px radius, 40px height, 120ms press scale .98. One
primary per view.
**Inputs/selects** — surface2 fill, border, 6px radius, blue focus ring
(2px outer, 25% alpha), labels above in 12px faint caps.
**Progress bar** — 8px track surface2, fill in semantic tone, animated.
**Chips/badges** — pill, tone at 12% background + full-strength text.
**Checklist row** — 44px min height (thumb-friendly), custom 22px check,
completed rows tint emerald and strike nothing (data stays legible).
**Chat bubbles** — user: blue 14% tint, right-aligned; coach: surface2
with cyan left bar; meta row beneath in mono (confidence, fallback note).
Thinking state: three cyan dots pulsing 1.2s.
**Heat strip** — 22px rounded cells, emerald alpha ramp by completion;
empty = surface2. Tooltip on hover.
**Modal/confirm** — center card, level-2 elevation, scrim blur; destructive
confirms restate consequences in body text, never in the button label.

## 9. Information architecture & flows

```
(public)  Home → Signup → [confirm email] → Login
(app)     Onboarding (one screen, sectioned: body → goal+timeframe → context)
          Today (dashboard: mission, pace card, quick links)
          Workout (today's session → per-exercise logging → finish)
          Nutrition (today so far → analyze/add → diary)
          Coach (chat with modes; memory link)
          Progress (headline + status → AI-authored stats → AI-authored charts → wins/risks/next)
          Plan (edit days/exercises/diet; regenerate lives on Profile)
          Memory (what the coach knows; categorized timeline)
          Profile (facts + "life changed" regenerate)   Settings (account, theme)
```

Screen-by-screen intent (the one job each screen has):
- **Home**: one promise, one CTA. No feature carousel.
- **Onboarding**: single scroll, three visually-grouped sections; the
  timeframe field carries the safety explanation inline — expectation-
  setting is part of the design, not a toast afterthought.
- **Today**: answer "what do I do right now?" above the fold — mission
  first, pace second, everything else below.
- **Workout session**: one exercise card at a time visually dominant;
  suggested load pre-filled; finishing is a single full-width action.
- **Progress**: the pace card is the headline (accent bar = status color);
  explanation bullets under it — *why* before charts.
- **Coach**: full-height chat; mode pills; empty state teaches what the
  coach already knows about you.
- **Settings**: account + theme toggle. Premium/subscription, wearables,
  community, coach-mode, admin: designed-for but not built — they slot in
  as new top-level routes without displacing the six core ones.

## 10. Accessibility

AA contrast minimum (checked per token pair above); 44px touch targets;
visible focus rings everywhere (`:focus-visible`, blue, 2px); all meaning
carried by color is duplicated in text ("Behind schedule", not just amber);
forms label every field; charts have text equivalents (the stat grid *is*
the chart's accessible twin); reduced-motion honored; keyboard path through
chat and forms verified.

## 11. Responsive rules

Mobile-first. Breakpoints: 640 / 960. Under 640: card grids collapse to
one column, page padding 16px, nav wraps to two rows, stat tiles go 2-up.
One-hand rule: primary actions in the lower half of forms, never top-right.

## 12. Figma organization

Pages: `00 Cover · 01 Tokens · 02 Type & Icons · 03 Components ·
04 Patterns (cards/chat/checklist) · 05 Screens – Mobile · 06 Screens –
Desktop · 07 Flows (arrows) · 08 Archive`. Components use slash naming
(`Card/Accent/Emerald`), variants for state (default/hover/active/
disabled), and every token from §4–§5 as a Figma variable with light/dark
modes. Screens link into flow frames matching §9.

## 13. Design QA checklist

- [ ] Every color on screen maps to a token; zero hex literals in JSX.
- [ ] Numbers are JetBrains Mono, tabular, unit-labeled.
- [ ] One primary button per view; destructive actions confirm with consequences.
- [ ] Semantic colors used only for their meaning (audit amber/red uses).
- [ ] Focus ring visible on every interactive element via keyboard.
- [ ] Dark AND light mode screenshot per screen before merge.
- [ ] Empty, loading, error states designed for every data surface.
- [ ] 360px-wide render has no horizontal scroll.
- [ ] Motion ≤320ms, single easing, reduced-motion verified.

## 14. Common UX mistakes we explicitly avoid

Stock athlete photography (unearned aspiration); confetti (celebration
inflation); circular progress rings for non-cyclic data (rings imply a
cycle — we use them for nothing yet); gradient-on-everything (one gradient,
one place); disabled-looking ghost buttons for primary actions; charts
without a text summary; "delightful" onboarding that delays the plan;
color-only status; modal stacking; asking for data we don't use.

## 15. Future expansion

Wearables land as new tiles in the existing stat grid (tokens already
cover them); computer-vision form checks reuse the coach chat surface;
community/leaderboard reuses card + table patterns; premium gates render
as an amber-chip "Pro" on existing components rather than separate
screens. The token system is the contract that keeps all of it coherent.
