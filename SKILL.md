---
applyTo: "**"
---

# Scooter Pages — Agent Skill

## What This Is

A plain HTML/CSS/JS component library with no build step, no framework. Pages are static `.html` files that use `data-sc` and `data-slot` attributes for component behavior and styling.

## Before You Start

**Read `SCOOTER_PAGES_AGENT_INSTRUCTIONS.md`** — it has the full component catalog, theming tokens, and code examples. This skill file is a quick-reference complement, not a replacement.

## Creating a New Page

1. Copy `pages/_template/` to `pages/<your-page>/`
2. Edit `index.html` — it has the full skeleton with page-meta, init function, and standalone guard

### The Page Contract

Every page must provide:

| Part | Purpose |
|---|---|
| `<main class="scooter-page">` | Content wrapper — PageLoader extracts this |
| `<script type="scooter/page-meta">` | JSON declaring script dependencies + init function name |
| `ScooterPageInit_<name>(root)` | Global init function (or `null` in page-meta for CSS-only pages) |
| DOMContentLoaded guard | Calls init when opened standalone in browser |

### Page-Meta Format

Place after `<body>`, before `<main>`:

```html
<script type="scooter/page-meta">
{
  "scripts": ["components/chart.js", "components/tabs.js"],
  "init": "ScooterPageInit_myPage"
}
</script>
```

- `scripts` — paths relative to **project root** (not the page file)
- `init` — global function name, or `null` for pages with no JS init

### Init Function Rules

```js
function ScooterPageInit_myPage(root) {
  var btn = root.querySelector('#my-button');  // scope to root, NOT document
  if (btn) { btn.addEventListener('click', handler); }
}
```

- Name: `ScooterPageInit_<camelCaseName>(root)`
- **Scope all queries to `root`** — the page runs inside a container when loaded dynamically
- No optional chaining (`?.`) — use `&&` or `if` checks
- No template literals — use string concatenation
- No `const`/`let` — use `var` (inline scripts execute via `new Function()`)

### Standalone Guard (bottom of page)

```js
document.addEventListener('DOMContentLoaded', function () {
  var main = document.querySelector('main.scooter-page');
  if (main) {
    Scooter.init(main);
    ScooterPageInit_myPage(main);
  }
});
```

## Key Rules

- `scooter-core.js` must load **before** any component script
- Use `data-slot="..."` for component parts, `data-sc="..."` on interactive roots
- Use CSS variables (`var(--primary)`) — never hardcode colors
- Page-specific CSS goes in a `<style>` block — never edit `base.css`
- Theming changes go in `custom.css`
- Paths from `pages/<name>/index.html`: `../../components.css`, `../../components/*.js`

## Dynamic Loading (PageLoader)

Host pages (`demo-sidebar-dynamic.html`, `demo-sidebar-dynamic-app.html`) use `PageLoader.load(url, container)` to fetch and inject pages. PageLoader:

1. Fetches the HTML, parses via DOMParser
2. Extracts `<main class="scooter-page">` content
3. Reads `<script type="scooter/page-meta">` for dependencies
4. Loads declared scripts (sequential, deduplicated)
5. Executes inline `<script>` blocks via `new Function()`
6. Calls `Scooter.init(container)`
7. Calls the declared init function with the container

To register a page in the sidebar, add a `<li>` with `data-page="../pages/<name>/index.html"` in the host page's nav.

## File Structure

```
components/           ← component scripts (accordion.js, chart.js, etc.)
  layout/
    page-loader.js    ← dynamic page loading utility
  scooter-core.js     ← runtime engine — always load first
base.css              ← all component CSS + design tokens
custom.css            ← editable theme tokens (colors, radius, shadows)
demo-pages/           ← demo/example pages
pages/                ← new pages go here
  _template/          ← starter template
```
