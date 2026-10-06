# Oracle Red Labs Design System

## Brand direction

Oracle Red Labs is a premium offensive-security practice. The interface should feel precise, controlled, and technically credible: black infrastructure, red operational signals, warm-white information, and disciplined zinc surfaces.

Black and red are the identity. White and zinc support legibility; they are not replacement brand colors. Avoid blue-violet AI gradients, generic technology grids, oversized glows, novelty hacker imagery, fabricated proof, or ornamental security clichés.

## Foundations

### Color

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `--color-bg` | `#050505` | Page background |
| Elevated black | `--color-bg-raised` | `#0D0D0F` | Sections, cards, panels |
| Sunken black | `--color-bg-sunken` | `#08080A` | Inputs, code, nested regions |
| Zinc surface | `--color-surface-2` | `#18181B` | Hover and raised states |
| Primary red | `--color-accent` | `#D13B3B` | Primary actions and structural accents |
| Red hover | `--color-accent-hover` | `#C5353D` | Accessible primary-action hover |
| Signal red | `--color-signal` | `#FF365F` | Hero energy, focus rings, small red text, high-intensity signals |
| Primary text | `--color-text` | `#FFFFFF` | Headings and body text |
| Secondary text | `--color-text-muted` | `#A1A1AA` | Supporting copy |
| Faint text | `--color-text-faint` | `#71717A` | Metadata and low-priority labels |
| Border | `--color-border` | `#27272A` | Dividers and default outlines |
| Strong border | `--color-border-strong` | `#3F3F46` | Hover and emphasized outlines |

Primary red and signal red have separate jobs. Primary red fills controls and anchors the brand. Signal red is brighter and should remain sparse: use it for the animated firewall, focus visibility, compact technical labels, and localized energy.

Semantic states retain their dedicated amber, blue, green, gray, and muted-red colors when color communicates status. Never collapse all statuses into brand red.

### Typography

- Display: `DM Sans`, variable `100–1000`, used for `h1–h4` and large editorial statements.
- Body and interface: `Inter`, variable `100–900`, used for navigation, paragraphs, forms, controls, and tables.
- Technical labels: `JetBrains Mono`, weights `400` and `600`, used for eyebrows, metadata, references, badges, and tabular data.
- All fonts are self-hosted under `frontend/assets/fonts/` with `font-display: swap` and system fallbacks.
- Large headings use tight tracking and balanced wrapping. Small mono labels use positive tracking and uppercase only where the current component calls for it.
- Preserve the fluid scale defined in `frontend/css/base.css`; do not introduce page-local arbitrary heading sizes unless the page already owns a display scale.

### Spacing and geometry

- Base rhythm: `4, 8, 12, 16, 24, 40, 64, 96px` through the shared spacing tokens.
- Shared container: `1200px` maximum with responsive inline padding.
- Control and card radius: `8px`; small internal details may use `4px`; pills and circular controls keep their explicit geometry.
- Borders are one pixel and zinc by default. Red borders indicate active, selected, focused, or high-priority states.
- Depth comes from inset top highlights, dark cherry-tinted shadows, and restrained red ambience—not heavy black drop shadows.

## Layout rules

- The landing hierarchy and its established composition remain canonical. Interior pages preserve semantic content order while using page-specific editorial compositions defined in `frontend/css/interior.css`.
- Shared foundations live in `frontend/css/layout.css` and `frontend/css/responsive.css`; landing composition lives in `frontend/css/landing.css`; the detached interior navigation, instrument mastheads, service ledger, sector atlas, archive, workbenches, operational surfaces, and footer composition live in `frontend/css/interior.css`.
- Do not add a generic grid texture to the page background. Use sparse radial illumination and directional falloff.
- Marketing prose should remain within the existing readable line-length limits. Data views may use wider tables with the current responsive stacking behavior.
- Maintain the 44px minimum target size for principal interactive controls.

## Components

### Navigation

The landing and interior navigation both use detached glass islands. Interior navigation remains sticky but floats within the canvas, condenses after the masthead leaves view, and expands into a near-full-screen command panel on mobile. Active links use red structure; keyboard focus, Escape handling, and no-JavaScript access remain intact.

### Buttons and links

- Primary: primary-red fill, white label, restrained red shadow, darker-red hover.
- Secondary: transparent or zinc-black surface with a zinc border; red enters at hover or focus.
- Ghost: low-emphasis text with a zinc hover surface.
- Destructive: retain the separate muted-danger treatment.
- Signal red may be used for inline text links where the darker primary red would not meet small-text contrast.

### Cards and panels

Use elevated black or zinc surfaces, an 8px radius, a zinc border, and a subtle inset highlight. Hover may lift using the existing transform and illuminate the border with restrained red. Do not create nested card stacks unless elevation communicates a real hierarchy.

### Forms

Fields use sunken black, zinc borders, white input text, and muted placeholders. Focus uses a primary-red border plus a visible red ring. Required and error information must never rely on color alone. Preserve inline validation, demo-only disclosure, and accessible status focus.

### Tables, filters, tabs, and badges

Technical labels and numeric data use JetBrains Mono or tabular figures. Selected filters and tabs use a red-tinted surface and red border. Status badges keep semantic colors; ordinary category tags remain neutral zinc.

## Landing-page visual language

The hero is the brand’s highest-energy moment. Its code-native firewall field uses deep cherry-black atmosphere, fragmented vertical signal columns, a luminous horizontal seam, and an interconnected route network. Bright signal red is allowed here at greater intensity than elsewhere.

Keep the centered headline, navigation, CTA positions, static trust rail, service bento, evidence sequence, outcomes carousel, and inquiry layout unchanged. The canvas remains deterministic, DPR-aware, pointer-responsive, paused offscreen, and static under reduced motion.

The service bento and downstream panels use the shared black-and-red palette. No violet light, blue-purple gradients, matrix rain, locks, shields, hooded figures, or proprietary game imagery should be introduced.

## Interior-page visual language

Interior pages extend the landing direction with a quieter editorial-dark system. Their mastheads pair oversized, tightly tracked display type with one code-native signal diagram whose geometry describes the page subject: branching routes for services, nested boundaries for methodology and engagement scope, sector nodes for audience pages, document strata for the vault, endpoint exchange for contact, verification contours for account access, and restrained telemetry for operational consoles.

- Keep diagrams abstract, sparse, and subordinate to the copy. Each is a real page instrument with labelled decision points, a registered field, and a restrained readout; CSS gradients and hairlines provide the rendering without literal locks, shields, hacker imagery, or ornamental grids.
- Shared content surfaces use a restrained double-bezel effect made from one zinc hairline, an inset highlight, a faint six-pixel outer register, and a dark-cherry ambient shadow. Avoid unnecessary nested markup when the same hierarchy can be expressed by the component surface.
- Section introductions use an editorial split at wide widths and return to one column below `900px`. Services use a numbered ledger rather than catalogue cards; audience pages use a sector atlas; research uses a variable archive; forms use workbenches with supporting rails; and dashboards use dense operational surfaces. Source order remains intact in every responsive collapse.
- The interior footer begins with a large, page-specific decision prompt before resolving into navigation and the academic disclosure. It should read as the final chapter of the page, not a utility strip.
- Interior entry motion uses `IntersectionObserver`, transform/translate, and opacity only. The masthead instrument may respond to pointer position through transform-based depth, the header condenses through an observer, and the mobile navigation reveals as a near-full-screen command panel with staggered links. Reduced-motion and no-JavaScript states expose complete content immediately.
- Shared forms, tables, filters, tabs, and workflow controls retain their established behavior, semantics, status colours, and responsive contracts while adopting the same surface depth and focus treatment.

## Illustration system

Downstream landing-page illustrations use a quiet hybrid of soft signal membranes and ambient topology. They translate service, evidence, methodology, and stakeholder concepts into one or two controlled gestures rather than literal devices. The hero remains the highest-energy visual; illustrations below it use lower contrast, shallower depth, and more negative space.

- Every asset uses genuine alpha transparency, including the evidence panorama. Translucent charcoal and dark-cherry membranes, broad muted-red route ribbons, sparse topology lines, and restrained warm-white verification points dissolve into the surrounding black surface.
- Primary red describes continuity and structure. Signal red is used sparingly at seams, routes, or active decision points. Warm white marks observation, registration, intentional stopping, and verified closure.
- Keep visual density low: favor one dominant field and one supporting route, or two broad interacting membranes. Avoid hard housings, cables, bolts, rubble, portals, machinery, sharp reflections, dense particles, and game-like props.
- Illustrations behave as ambient spatial layers, not framed pictures or standalone icons. Service signals sit behind their card copy, the evidence route spans the section behind its heading and scrubbed statement, the methodology boundary occupies the introductory field, and stakeholder artwork is embedded in each carousel surface.
- Service artwork stays quieter near headings and links. Evidence uses a frameless multidirectional fade instead of a bordered container. Methodology and outcome artwork may receive only broad low-opacity haze, never a localized glow disc or pronounced drop shadow.
- Crop with `object-fit`, transparent negative space, and low-contrast edge masks rather than stretching. Preserve the semantic gesture on narrow screens even when peripheral detail is cropped.
- Generated artwork may use the existing `.media-motion` treatment. Scroll motion is limited to slow transform and opacity interpolation that reinforces route progression, boundary observation, or convergence; never add autonomous downstream loops. Reduced-motion and no-JavaScript states show the complete static composition.
- Below-fold images require explicit dimensions, lazy loading, and asynchronous decoding. Keep the complete landing illustration payload at approximately 1.1 MB or less.
- Do not use text, logos, watermarks, people, weapons, hacker figures, locks, shields, skulls, badges, Matrix-style rain, generic circuit-board scenery, violet light, or proprietary game imagery.

The canonical filename, prompt, crop, and placement record lives in `frontend/assets/images/landing/README.md` and must remain synchronized with the shipped assets.

## Motion

- Existing JavaScript and GSAP choreography is canonical. Do not change timing, triggers, pinning behavior, carousel movement, canvas behavior, or reveal sequencing as part of visual-only work.
- DOM motion is limited to transforms and opacity. State transitions use the existing timing tokens.
- `prefers-reduced-motion` must expose complete, readable final states immediately.
- Pages remain usable when JavaScript, GSAP, or canvas is unavailable.

## Accessibility and responsive behavior

- Maintain visible `:focus-visible` treatment using signal red.
- Preserve semantic headings, labels, live regions, keyboard controls, skip links, and ARIA states.
- White text on primary red and all small text/background combinations must meet WCAG AA contrast.
- Never encode status with color alone.
- Prevent horizontal page overflow; tables are the only intentional local horizontal scrollers.
- Verify the system at `375`, `768`, `1024`, `1440`, and `1920px` widths.

## Extending the system

1. Reuse the shared tokens before introducing a new value.
2. Keep black and red dominant; use semantic colors only for meaning.
3. Add visual depth with surface steps, inset highlights, and controlled radial light.
4. Preserve existing layout and motion contracts unless a task explicitly authorizes structural change.
5. Record any lasting token or component convention in this document and keep it synchronized with the shipped CSS.

## Notification surfaces

- Client notifications reuse the interior masthead, organization context, typography, and black/red palette. The active organization and role appear above the feed; role-ineligible email categories stay hidden.
- Use a flat list separated by zinc hairlines. Unread rows use elevated black plus an explicit “Unread” label; read rows retain an explicit “Read” label. Titles, supporting copy, and mono timestamps keep the shared hierarchy.
- All/Unread filters use the established red-tinted selected treatment. Keep Open and read/unread actions beside each row at wide widths and below its copy at narrower widths. Rows and the supporting panels collapse to one column below 900px; small screens retain wrapping controls and 44px targets.
- The labeled navigation link carries a compact primary-red count badge, visually capped at 99+ while its accessible name preserves the exact count. Incoming invitations occupy a separate panel and do not contribute to that badge.
- Loading, empty, retryable error, unavailable destination, and organization-switch confirmation states use visible text and existing notice/status components. Clear old organization content before switching, preserve keyboard focus after row updates, and announce action results through the polite live region.
- No-JavaScript mode exposes the session/permission explanation and navigation while hiding unavailable notification controls. Reduced motion inherits the complete static interior presentation.

## Transactional email surfaces

These conventions apply to the HTML and plain-text account-update and organization-invitation templates in `backend/src/email-templates.js`. Email preserves the established black-and-red identity through a compact, flat reading surface. The system-font and static-layout choices below are email-specific; the website's typography, depth, and motion contracts remain authoritative for web pages.

- **Palette and shape:** use the existing near-black canvas (`#050505`), elevated-black panel (`#0D0D0F`), zinc hairline (`#27272A`), white text (`#FFFFFF`), muted supporting text (`#A1A1AA`), and primary red (`#D13B3B`). The panel has a one-pixel border and gently curved corners (`8px`); the action shares that radius. Depth comes from the panel's tonal step, without shadows, gradients, or glow.
- **Layout:** one centered, responsive column with a maximum panel width of `600px`, outer padding of `24px 12px`, and panel padding of `40px`. An optional media query at `600px` and below reduces panel padding to `24px`. Preserve reading order: text wordmark, heading, message, instruction, primary action, visible destination, guidance, then disclosure. Essential inline formatting remains usable when the head style block is removed.
- **Typography:** use `Arial, Helvetica, sans-serif` throughout email. The text wordmark is bold (`700`, `20px/24px`, `0.8px` tracking), with white ORACLE and primary-red RED LABS. The single heading is bold (`700`, `28px/36px`, `-0.5px` tracking), reduced to `26px/32px` by the mobile query. Message and instruction use `16px/26px`; destination and guidance use `14px/22px`; the quiet footer uses `12px/20px`. Keep the red wordmark at its large, bold size: its measured panel contrast is `4.07:1`, while white action text on red is `4.77:1` and muted text on the panel is `7.58:1`.
- **The One Action Rule.** Provide one primary-red button with a bold white label (`16px/24px`), padding of `12px 24px`, and a one-pixel red border. Its shipped styled height is `50px`, exceeding the `44px` principal-target minimum. Follow it with an underlined white supporting URL pointing to the same destination. Escape dynamic copy and HTML attributes; allow long names and visible URLs to wrap, using optional URL break points that add no characters and never alter the destination. The plain-text alternative carries the same message, destination, guidance, and disclosure.
- **The Generic Update Rule.** Account-update subject, HTML title, hidden preview, message, and plain text remain generic. Use “An update is available” and “Sign in to review it,” without interpolating event category, organization name, role, engagement, invoice, or member details into copy. The supporting note is “You can change event email preferences in Notifications.” Preserve the existing authorized account deep link.
- **Invitation guidance:** identify only the inviting organization and intended role. Existing accounts review received invitations; new accounts sign in or create an account to review the invitation through the existing token destination. Say that invitations expire seven days after creation and that unexpected invitations can be ignored. Do not imply a renewed expiry window after delivery or retry, and do not add unsubscribe or preference promises to invitations.
- **Delivery-safe structure and footer:** use presentation tables, inline essential styles, a semantic heading, and the matching plain-text alternative. Branding is styled text, with no images, remote fonts or assets, tracking, motion, promotional content, greeting, or invented support address. Separate the footer with a zinc hairline and `24px` top padding; retain “Oracle Red Labs is a fictional company created for an academic project (ITS122P).”
- **Verification boundary:** local Chrome evidence in `output/email-previews/browser-checks.json` and `output/email-previews/screenshots/` covers six fixtures at `1440`, `375`, and `390px`, including long content, inline-only styles, and complete styling removal. All 18 previews preserve destinations and readable content without horizontal overflow or remote requests; the unstyled fallback uses ordinary text and links rather than retaining styled button geometry. Actual Gmail inbox rendering, client dark-mode rewriting, and Outlook inbox behavior remain manual checks described in `docs/EMAIL-TEMPLATES.md`.
