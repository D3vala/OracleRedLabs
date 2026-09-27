# Landing Illustration Manifest

These eight original images support the Oracle Red Labs landing page. They were generated independently with the built-in image-generation workflow, then softened and exported as alpha-preserving WebP files. The complete production set is approximately 473 KB.

## Shared direction

- Visual world: translucent charcoal and dark-cherry signal membranes, broad muted-red route ribbons, sparse ambient topology, shallow depth, and restrained warm-white verification points.
- Density: one or two dominant gestures per image, broad tonal transitions, generous transparent negative space, and no literal product hardware.
- Palette: smoke black, charcoal, dark cherry, `#D13B3B`, sparse `#FF365F`, and warm white. The landing hero remains brighter and more energetic than every downstream illustration.
- Transparency: every file, including the evidence panorama, contains genuine alpha transparency with feathered outer edges. Do not add an opaque backing during export.
- Restrictions: no text, letters, numbers, logos, watermarks, people, hacker imagery, weapons, housings, cables, bolts, rubble, portals, complex machinery, hard reflections, dense particles, locks, shields, badges, skulls, violet or blue light, generic grids, Matrix effects, or proprietary references.
- Accessibility: all assets are decorative because adjacent HTML communicates their meaning. Use `alt=""` and an `aria-hidden` wrapper.
- Delivery: retain explicit intrinsic dimensions, `loading="lazy"`, and `decoding="async"`. Do not stretch. Use `object-fit`, transparent negative space, and restrained edge masks for responsive crops.
- Performance: keep the aggregate production payload at approximately 1.1 MB or less. The current set is approximately 473 KB.

The prompts below inherit the shared palette, transparency, style, and restriction rules above.

## Assets

### `oracle-ai-surface.webp`

- Placement: lower visual field of the large ORACLE AI service card.
- Intrinsic size: 1448 × 1086; transparent background.
- Crop: use as a large ambient layer behind the card copy, weighting the controlled seam toward the lower right. Fade the perimeter before it reaches headings and links.
- Generation prompt: create a calm abstract security field in which one broad translucent charcoal membrane curves around a protected dark center while four faint crimson signal traces approach from the outer edges and meet at one softly illuminated controlled seam; soft-rendered 2.5D editorial abstraction, wide 4:3 composition, two dominant shapes, low-contrast cherry illumination, generous transparent negative space.

### `phantasm-lateral-field.webp`

- Placement: lower-right atmosphere of the PHANTASM service card.
- Intrinsic size: 1536 × 1024; transparent background.
- Crop: extend the overlapping membranes behind the card’s right half and fade their left edge beneath the copy rather than presenting the asset as a discrete object.
- Generation prompt: create three overlapping translucent charcoal security membranes crossed by one quiet crimson lateral route that bends gently through each layer, with three sparse warm-white observation points; compact landscape composition, shallow diagonal flow, diffused dark-cherry illumination, minimal detail.

### `chainbreak-release-chain.webp`

- Placement: lower-right atmosphere of the CHAINBREAK service card.
- Intrinsic size: 1774 × 887; transparent background.
- Crop: run the provenance ribbon through the lower card atmosphere, preserving the interruption and verified continuation while its left edge disappears behind copy.
- Generation prompt: create a soft provenance sequence made from four small translucent charcoal nodes joined by one broad muted-crimson ribbon, introduce one clean intentional gap before the final node, then continue as a thinner verified route ending in a restrained warm-white point; compact landscape composition, gentle shallow arc, simple silhouette.

### `evidence-attack-to-closure.webp`

- Placement: inline crop inside the evidence heading and a large frameless route layer spanning behind the heading and scrubbed evidence statement.
- Intrinsic size: 2172 × 724; transparent background.
- Crop: use the complete 3:1 route as the evidence stage’s spatial spine. On narrow screens preserve both exposure and closure. Apply multidirectional feathering and a central text-protection scrim; never add a border, inset frame, or opaque backing.
- Generation prompt: show one calm continuous crimson route moving left to right from a diffuse exposure cloud, passing through three barely visible translucent evidence envelopes, and resolving into a soft contained warm-white closure halo; ultra-wide 3:1 panorama, shallow depth, very low detail, quiet negative space above and below.

### `method-controlled-boundary.webp`

- Placement: ambient boundary field behind the methodology introduction on desktop, settling beneath the copy before the process steps on narrow screens.
- Intrinsic size: 1122 × 1402; transparent background.
- Crop: enlarge the nested boundaries so they occupy the introductory field while retaining the three observation gates and clear endpoint. Fade every outer edge into the section.
- Generation prompt: create nested translucent charcoal scope membranes defining a controlled testing boundary, with one broad muted-crimson route passing through exactly three softly illuminated observation gates and stopping at a restrained warm-white endpoint before the outermost boundary; vertical 4:5 composition, two or three dominant forms, calm and methodical.

### `outcome-security-leaders.webp`

- Placement: ambient layer embedded behind the Security leaders carousel surface.
- Intrinsic size: 1254 × 1254; transparent background.
- Crop: enlarge the convergence gesture behind the role label while preserving quiet space beneath the headline.
- Generation prompt: create four subdued charcoal and dark-cherry route ribbons approaching from different directions and softly converging into one prioritized muted-crimson focal field, with a single restrained warm-white verification point; square composition, one dominant convergence gesture, balanced without becoming radial or emblem-like.

### `outcome-engineering-teams.webp`

- Placement: ambient layer embedded behind the Engineering teams carousel surface.
- Intrinsic size: 1254 × 1254; transparent background.
- Crop: enlarge all three translucent layers behind the role label while keeping their corresponding registration points visible.
- Generation prompt: create three separated translucent charcoal layers floating in shallow depth and aligned by one reproducible muted-crimson route, with four sparse warm-white registration points visibly corresponding across the layers; square composition, one clear diagonal alignment gesture, three broad layers only.

### `outcome-executive-sponsors.webp`

- Placement: ambient layer embedded behind the Executive sponsors carousel surface.
- Intrinsic size: 1254 × 1254; transparent background.
- Crop: enlarge the three open arcs behind the role label and diffuse them before they reach the headline, without closing them into a badge, seal, shield, lock, or full ring.
- Generation prompt: create exactly three separate soft charcoal membrane arcs arranged as an incomplete asymmetric enclosure around a small diffuse dark-cherry risk cloud; keep the arcs visibly open and non-circular, then resolve only the smallest final gap with a short restrained warm-white bridge; dark, measured, low contrast, with ample transparent negative space.

## Production treatment

- Source renders are softened at high density before WebP export so fine alpha noise does not become visual grit.
- Alpha remains genuine but uses a restrained number of opacity steps to keep feathered edges compact and stable in browsers.
- Existing `.media-motion` and GSAP ScrollTrigger hooks provide slow route progression, depth drift, and convergence through transforms and opacity only. Do not add asset-specific autonomous loops.
- Reduced-motion, missing-GSAP, and no-JavaScript states must show the complete static image.

## Maintenance

When replacing an asset, preserve its filename, intrinsic dimensions, transparency, and semantic gesture unless the consuming HTML and responsive rules change in the same commit. Inspect the result on black before integration, re-run desktop and mobile visual checks, update the prompt and crop notes here, and keep the aggregate illustration payload within the documented budget.
