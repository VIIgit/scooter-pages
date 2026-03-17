# scooter-pages

Lightweight collection of demo pages and components for Scooter UI.

Purpose
- Provide small, focused demo pages and reusable components for building
  UI patterns. The repository contains both demo pages (for interactive
  examples) and production-oriented pages under `pages/` that are safe to
  load inside the sidebar/demo-shell.

Structure
- `components/` — individual JS components used by pages.
- `demo-pages/` — interactive demo examples with extra UI scaffolding.
- `pages/` — application pages intended for inclusion in the dynamic
  sidebar; pages must use `<main class="scooter-page">`.
- `base.css`, `custom.css` — global styles.

Quick start
1. Serve locally from the project root:
```bash
# using Python
python -m http.server 8765

# then open http://localhost:8765/demo-pages/demo-sidebar-dynamic.html
```

Page conventions
- New pages should be created under `pages/<name>/index.html`.
- Keep component scripts referenced from `../../components/` (relative paths
  from `pages/<name>/index.html`).
- Do not include demo-only scaffolding (`demo-*` classes or `toggleCode`) in
  `pages/` pages — those are for `demo-pages/` only.

License
This project is licensed under the Apache License 2.0 — see `LICENSE`.

Contributing
- See `SCOOTER_PAGES_AGENT_INSTRUCTIONS.md` for page templates and contributor
  guidance.

Contact
- Owner: `VIIgit`.

