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

- The existing HTML hierarchy, container widths, grid tracks, section spacing, breakpoints, responsive order, and component placement are canonical.
- Shared layout rules live in `frontend/css/layout.css` and `frontend/css/responsive.css`. Page-specific landing composition lives in `frontend/css/landing.css`.
- Do not add a generic grid texture to the page background. Use sparse radial illumination and directional falloff.
- Marketing prose should remain within the existing readable line-length limits. Data views may use wider tables with the current responsive stacking behavior.
- Maintain the 44px minimum target size for principal interactive controls.

## Components

### Navigation

The shared header remains sticky and translucent with a zinc divider and subtle inner highlight. The landing navigation remains a detached glass island. Active links use red structure; mobile menu behavior and focus management are unchanged.

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
