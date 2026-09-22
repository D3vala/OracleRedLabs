# Oracle Red Labs — ITS122P Project

A fictional offensive-security consultancy site. Static HTML/CSS/JS only —
**no build step, no dependencies**: open `frontend/index.html` in a browser
and it works.

## Repository layout

```
OracleRedLabs/
├── frontend/           # The entire static site
│   ├── *.html          # 11 pages (index, methodology, services, who-we-serve,
│   │                   #   vault, contact, register, login, engage, dashboard, admin)
│   ├── css/            # base.css, layout.css, components.css, responsive.css
│   ├── js/             # main, typewriter, vault-filter, engage-form + data/
│   ├── assets/         # images (logo, vault covers)
│   └── _build/         # Template sources the HTML pages were assembled from:
│       ├── header.txt      # shared <head> + site header/nav, with {{TITLE}}/{{DESC}}
│       ├── footer.txt      # shared </footer> + script tags, with {{PAGE_SCRIPTS}}
│       └── pages/*.main.txt# the page-unique <main> content
├── backend/            # Reserved for the future API (see backend/README.md)
└── README.md
```

### Why `_build/` exists

All 11 pages share a byte-for-byte identical header, nav and footer. The
`_build/` fragments are the single source of truth they were assembled from:

```
page.html = header.txt ({{TITLE}}, {{DESC}} substituted)
          + pages/<page>.main.txt
          + footer.txt ({{PAGE_SCRIPTS}} substituted)
```

The shipped `.html` files are the deliverable and are what the browser loads;
`_build/` is never referenced at runtime. When editing the shared header or
footer, either re-assemble all 11 pages or apply the change to every `.html`
file — consistency is checked by the smoke tests (one `<h1>`, one active nav
marker, no duplicate IDs, on every page).

### Why `backend/` is empty

Every form is a browser-only demo stub on purpose; the planned endpoints and
their front-end call sites are documented in
[`backend/README.md`](backend/README.md).

## Running

Just open `frontend/index.html` — there is nothing to install or build.

## Front-end features

- **Typewriter hero** — `js/typewriter.js` types the tagline, with the full
  sentence exposed to screen readers.
- **Data-driven rendering** — service cards and vault entries render from
  `js/data/*.js` on every page that shows them.
- **Three-step engagement funnel** — `js/engage-form.js` validates per step,
  then produces an `ORL-######` reference and a recap.
- **Vault filter + live search** — `js/vault-filter.js` combines category
  buttons with a text query and a live result counter.

