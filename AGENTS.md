# Repository Guidelines

## Project Structure

`frontend/` contains the build-free website. Its page-level HTML files live at the folder root; shared and page-specific styles are in `frontend/css/`; browser scripts and data are in `frontend/js/` (including `js/data/` and vendored libraries in `js/vendor/`); images, icons, and fonts are in `frontend/assets/`. `backend/` is reserved for a future API and currently contains only planning documentation. There is no automated test directory or server implementation yet.

## Build, Test, and Development

No install or build step is required. Open `frontend/index.html` in a browser, or serve the frontend locally for consistent relative paths:

```sh
python -m http.server 8000 --directory frontend
```

Then visit `http://localhost:8000`. There is no automated test command; verify changes in a browser at desktop and mobile widths and exercise affected navigation, forms, and page interactions.

## Coding Style

Keep the site dependency-free and compatible with its existing plain HTML, CSS, and JavaScript structure. Match the two-space indentation used in HTML/CSS/JS. Use lowercase, hyphen-separated names for page and asset files (for example, `who-we-serve.html` or `hero-network.js`). Keep shared styling in `base.css`, `layout.css`, `components.css`, and `responsive.css`; put page-specific rules in the matching page stylesheet. Use semantic HTML, accessible labels, and preserve graceful behavior when JavaScript is unavailable. Avoid introducing a framework or build tooling without a clear project need.

## Testing Guidelines

There is no test framework or coverage requirement. For each change, preview affected pages in a browser, check console errors, test interactive behavior, and confirm responsive layouts. For shared header or footer changes, check multiple pages because the markup is currently repeated rather than generated from a template.

## Commits and Pull Requests

The existing history uses short, plain summaries (for example, `landing page` and `frontend`); keep commit subjects concise and specific. A pull request should explain the user-visible change, list the pages or assets affected, note browser checks performed, and include screenshots for visual changes. Link a related issue when one exists.

## Security and Configuration

Forms and account pages are front-end demos; do not describe them as secure or connected to a live service. Never add credentials or private configuration to the repository. Keep the backend documentation clear about planned versus implemented API behavior.
