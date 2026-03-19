# Scooter Pages — Agent Instructions

> **Purpose**: Production-ready plain HTML/CSS/JS component library. AI agents use this document to create new web pages. **No build step, no framework, no package manager** — just static files served from a folder.

---

## 1. Project Structure

```
scooter-pages/                ← project root
  AGENT_INSTRUCTIONS.md       ← THIS FILE — read it before generating any page
  custom.css                  ← ★ EDIT THIS to re-theme (colors, radius, shadows)
  base.css                    ← design tokens, reset, typography, all component CSS
                                 (imports custom.css automatically)
  components/
    scooter-core.js           ← runtime engine — ALWAYS load first
    accordion.js
    alert-dialog.js
    avatar.js
    calendar.js
    carousel.js
    chart.js
    checkbox.js
    collapsible.js
    command.js
    context-menu.js
    dialog.js
    drawer.js
    dropdown-menu.js
    form.js
    hover-card.js
    image-with-fallback.js
    input-otp.js
    menubar.js
    navigation-menu.js
    popover.js
    radio-group.js
    resizable.js
    scroll-area.js
    select.js
    sheet.js
    sidebar.js
    slider.js
    switch.js
    tabs.js
    toast.js
    toggle.js
    toggle-group.js
    tooltip.js
  demo-pages/                 ← built-in demo / example pages
    demo.css                  ← shared demo-page styles (optional for new pages)
    demo-css-only.html
    demo-light-js.html
    demo-medium-js.html
    demo-complex-js.html
    demo-patterns.html
    demo-dashboard.html
    demo-sidebar-dynamic.html ← sidebar shell with dynamic page loading
  pages/                      ← ★ NEW PAGES go here (one subfolder per page)
    _template/
      index.html              ← copy this to start a new page
    my-page/
      index.html
```

### Key Conventions

| Convention | Rule |
|---|---|
| Component wrapper | `data-sc="componentName"` on the root element |
| Internal parts | `data-slot="part-name"` on child elements |
| Variants | `data-variant="default\|secondary\|outline\|ghost\|destructive"` |
| Sizes | `data-size="default\|sm\|lg\|icon"` |
| Paths | From `pages/<name>/index.html`: `../../components.css`, `../../components/*.js` |
| Sidebar-compatible | Wrap content in `<main class="scooter-page">` — required for dynamic loading |
| Styling | Use CSS custom properties (`var(--primary)`) — never hardcode colors |
| Scripts | `scooter-core.js` first, then only the component scripts the page uses |

---

## 2. HTML Boilerplate for New Pages

Every page **must** start with this template (also available at `pages/_template/index.html`).  
Copy `pages/_template/` to `pages/<your-page-name>/` and edit `index.html`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Title — Scooter Pages</title>
  <link rel="stylesheet" href="../../components.css" />
  <!-- base.css auto-imports custom.css — no extra link needed -->
  <style>
    /* Page-specific styles go here (not in base.css) */
  </style>
</head>
<body>

<!--
  IMPORTANT: The sidebar-dynamic page extracts content via
  doc.querySelector('main.scooter-page') — keep this wrapper.
-->
<main class="scooter-page">
  <h1>Page Title</h1>
  <p>Short description.</p>

  <section id="example">
    <h2>Section</h2>
    <!-- page content -->
  </section>
</main>

<!-- Scripts: always load scooter-core FIRST, then only components used -->
<script src="../../components/scooter-core.js"></script>
<!-- <script src="../../components/tabs.js"></script> -->
</body>
</html>
```

> **Why `<main class="scooter-page">`?** The sidebar-dynamic loader (`demo-pages/demo-sidebar-dynamic.html`) fetches the full HTML, then runs `doc.querySelector('main.scooter-page, main.demo-page')` to extract only the content. Without this wrapper, the page will show *"No content found"* when loaded dynamically. Scripts outside `<main>` are intentionally excluded — the sidebar page pre-loads all component scripts. Existing demo pages use `demo-page`; new pages under `pages/` must use `scooter-page`.

> **Note**: The `demo-*` CSS classes (`demo-card`, `demo-preview`, `demo-code-block`, `demo-code-toggle`, `demo-section`, `demo-subtitle`, `demo-desc`) and the `toggleCode` function are **only for demo pages** in the `demo-pages/` folder. Do not use them in new pages under `pages/`. New pages should use plain semantic HTML with Scooter components directly.

### Rules for New Pages

1. **Create a subfolder** under `pages/` — e.g. `pages/my-page/index.html`.  
   Copy `pages/_template/index.html` as your starting point.
2. **Wrap all visible content** in `<main class="scooter-page">`.  
   The sidebar-dynamic page extracts content via `doc.querySelector('main.scooter-page')` — if this wrapper is missing, the page will show "No content found" when loaded dynamically. (Existing demo pages use `main.demo-page` which is also supported.)
3. Only include `<script>` tags for components **actually used** on the page.
4. `scooter-core.js` must always come **before** any component script.
5. Add page-specific CSS in a `<style>` block — **never modify `base.css`**.
6. For theming changes, edit `custom.css` instead.
7. Use semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`, `<dialog>`).
8. Paths from `pages/<name>/index.html`: use `../../components.css` and `../../components/*.js`.
9. **Standalone + sidebar dual-mode**: Each page must work when opened directly in the browser *and* when loaded into `demo-sidebar-dynamic.html`. No special scaffolding is needed — just keep the `<main class="scooter-page">` wrapper and use Scooter components directly.
10. **Do not use demo-specific patterns**: The `demo-*` CSS classes (`demo-card`, `demo-preview`, `demo-code-block`, `demo-section`, etc.), `toggleCode`, and `demo.css` are **only for pages in `demo-pages/`**. New pages should use plain semantic HTML.
10. **To register a page in the sidebar**, add a `<li>` entry in `demo-pages/demo-sidebar-dynamic.html` with a `data-page` attribute pointing to `../pages/<name>/index.html`.

---

## 3. Theming & Customization — `custom.css`

All customizable visual tokens live in **`custom.css`**. Edit that single file to re-brand the entire library.

`base.css` imports `custom.css` via `@import url('custom.css')` so pages only need one stylesheet link.

### Color Tokens

| Token | Default | Purpose |
|---|---|---|
| `--background` | `#ffffff` | Page background |
| `--foreground` | `#1d1d1f` | Primary text |
| `--primary` | `#007aff` | Primary actions, links, focus rings |
| `--primary-foreground` | `#ffffff` | Text on primary backgrounds |
| `--primary-dark` | `#0051d5` | Hover/active state for primary |
| `--secondary` | `#f5f5f7` | Secondary backgrounds |
| `--secondary-foreground` | `#1d1d1f` | Text on secondary |
| `--muted` | `#ececf0` | Muted / disabled backgrounds |
| `--muted-foreground` | `#86868b` | Muted text, placeholders, captions |
| `--accent` | `#e9ebef` | Hover/focus accent backgrounds |
| `--accent-foreground` | `#1d1d1f` | Text on accent |
| `--destructive` | `#d4183d` | Error / destructive actions |
| `--destructive-foreground` | `#ffffff` | Text on destructive |
| `--success` | `#34c759` | Success indicators |
| `--success-foreground` | `#ffffff` | Text on success |
| `--border` | `rgba(0,0,0,0.1)` | Borders |
| `--input-background` | `#f3f3f5` | Input field backgrounds |
| `--ring` | `#007aff` | Focus ring color |

### Gray Scale

| Token | Default |
|---|---|
| `--gray-50` | `#f5f7fa` |
| `--gray-100` | `#f5f5f7` |
| `--gray-200` | `#e8ecf1` |
| `--gray-300` | `#d1d1d6` |
| `--gray-400` | `#b8b8bd` |
| `--gray-500` | `#86868b` |
| `--gray-600` | `#6e6e73` |
| `--gray-700` | `#515154` |
| `--gray-800` | `#1d1d1f` |

### Chart Colors

| Token | Default | Usage |
|---|---|---|
| `--chart-1` | `#e06432` | First data series |
| `--chart-2` | `#2a9d8f` | Second data series |
| `--chart-3` | `#264653` | Third data series |
| `--chart-4` | `#e9c46a` | Fourth data series |
| `--chart-5` | `#d4a053` | Fifth data series |

### Sidebar Colors

| Token | Default |
|---|---|
| `--sidebar` | `#fafafa` |
| `--sidebar-foreground` | `#1d1d1f` |
| `--sidebar-primary` | `#007aff` |
| `--sidebar-primary-foreground` | `#ffffff` |
| `--sidebar-accent` | `#f5f5f7` |
| `--sidebar-accent-foreground` | `#1d1d1f` |
| `--sidebar-border` | `#e5e5e5` |

### Radius

| Token | Default | Pixels |
|---|---|---|
| `--radius-sm` | `0.375rem` | 6px |
| `--radius-md` | `0.5rem` | 8px |
| `--radius` | `0.625rem` | 10px |
| `--radius-lg` | `0.625rem` | 10px |
| `--radius-xl` | `0.875rem` | 14px |
| `--radius-2xl` | `1rem` | 16px |
| `--radius-full` | `9999px` | Pill |

### Shadows

| Token | Default |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` |
| `--shadow-md` | `0 4px 24px rgba(0,0,0,0.06)` |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.08)` |
| `--shadow-xl` | `0 12px 48px rgba(0,0,0,0.12)` |

### Other Tokens (in base.css, not in custom.css)

| Token | Value | Purpose |
|---|---|---|
| `--font-size` | `16px` | Root font size |
| `--ease-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default easing |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Spring easing |
| `--duration-fast` | `200ms` | Quick transitions |
| `--duration-normal` | `300ms` | Standard transitions |
| `--duration-slow` | `500ms` | Slow transitions |
| `--z-dropdown` | `50` | Dropdowns |
| `--z-sticky` | `100` | Sticky headers |
| `--z-overlay` | `200` | Overlays |
| `--z-modal` | `300` | Modals |
| `--z-popover` | `400` | Popovers |
| `--z-tooltip` | `500` | Tooltips |
| `--z-toast` | `600` | Toast notifications |

---

## 4. Layout Patterns

### `.page`
Full-height wrapper. Apply to a `<div>` wrapping everything.

### `.container`
Max-width centered content (`1280px`, with `24px` horizontal padding). Use for `<main>`.

### `.header`
Sticky top header with blur backdrop. Contains the page title.

### Grid / Flex
Use standard CSS with `gap`. Common pattern:
```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
gap: 16px;
```

### Spacing
Use multiples of `4px`. Common values: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.

---

## 5. Component Catalog

Components come in two types:

| Type | How it works | Needs JS? |
|---|---|---|
| **CSS-only** | Use the correct `data-slot` attributes — `base.css` handles styling | No |
| **JS-enhanced** | Also needs the matching `<script>` tag. Self-registers via `Scooter.register()` and auto-inits on `data-sc="name"` elements | Yes |

---

### 5.1 Button
**Type**: CSS-only  
**Variants**: `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`  
**Sizes**: `default`, `sm`, `lg`, `icon`

```html
<button data-slot="button" data-variant="default" data-size="default">
  Click me
</button>
<button data-slot="button" data-variant="outline" data-size="sm">
  Small outline
</button>
<button data-slot="button" data-variant="destructive" data-size="icon">
  ×
</button>
```

**With icon:**
```html
<button data-slot="button">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
       stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
  </svg>
  Download
</button>
```

**Button group (single select):**
```html
<div data-slot="button-group">
  <button data-slot="button" data-variant="outline" aria-pressed="true" data-value="day">Day</button>
  <button data-slot="button" data-variant="outline" aria-pressed="false" data-value="week">Week</button>
  <button data-slot="button" data-variant="outline" aria-pressed="false" data-value="month">Month</button>
</div>

<script>
const group = document.querySelector('[data-slot="button-group"]');
group.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-slot="button"]');
  if (!btn) return;
  group.querySelectorAll('[data-slot="button"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  btn.setAttribute('aria-pressed', 'true');
});
</script>
```

**Loading state:**
```html
<button data-slot="button" data-loading>
  <span class="button-spinner"></span>
  Saving…
</button>
```

**As link:** `<a data-slot="button" href="/path">Link Button</a>`

**Full width:** `<button data-slot="button" style="width:100%">Full Width</button>`

---

### 5.2 Card
**Type**: CSS-only

```html
<div data-slot="card">
  <div data-slot="card-header">
    <h3 data-slot="card-title">Title</h3>
    <p data-slot="card-description">Description</p>
  </div>
  <div data-slot="card-content">
    <p>Content goes here.</p>
  </div>
  <div data-slot="card-footer">
    <button data-slot="button">Action</button>
  </div>
</div>
```

---

### 5.3 Badge
**Type**: CSS-only  
**Variants**: `default`, `secondary`, `outline`, `destructive`

```html
<span data-slot="badge" data-variant="default">Active</span>
<span data-slot="badge" data-variant="destructive">Error</span>
```

---

### 5.4 Input
**Type**: CSS-only

```html
<input data-slot="input" type="text" placeholder="Enter value…" />
```

---

### 5.5 Textarea
**Type**: CSS-only

```html
<textarea data-slot="textarea" placeholder="Write here…" rows="4"></textarea>
```

---

### 5.6 Label
**Type**: CSS-only

```html
<label data-slot="label" for="fname">First Name</label>
```

---

### 5.7 Separator
**Type**: CSS-only  
**Orientation**: `data-orientation="horizontal"` (default) or `"vertical"`

```html
<div data-slot="separator"></div>
```

---

### 5.8 Skeleton
**Type**: CSS-only

```html
<div data-slot="skeleton" style="width:200px;height:20px;"></div>
<div data-slot="skeleton" style="width:48px;height:48px;border-radius:9999px;"></div>
```

---

### 5.9 Table
**Type**: CSS-only

```html
<div data-slot="table-container">
  <table data-slot="table">
    <thead>
      <tr data-slot="table-row">
        <th data-slot="table-head">Name</th>
        <th data-slot="table-head">Status</th>
      </tr>
    </thead>
    <tbody>
      <tr data-slot="table-row">
        <td data-slot="table-cell">Item A</td>
        <td data-slot="table-cell">Active</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td data-slot="table-footer" colspan="2">Total: 1</td>
      </tr>
    </tfoot>
  </table>
</div>
```

---

### 5.10 Breadcrumb
**Type**: CSS-only

```html
<nav data-slot="breadcrumb">
  <ol data-slot="breadcrumb-list">
    <li data-slot="breadcrumb-item">
      <a data-slot="breadcrumb-link" href="#">Home</a>
    </li>
    <li data-slot="breadcrumb-separator">/</li>
    <li data-slot="breadcrumb-item">
      <span data-slot="breadcrumb-page">Current</span>
    </li>
  </ol>
</nav>
```

---

### 5.11 Pagination
**Type**: CSS-only

```html
<nav data-slot="pagination">
  <ul data-slot="pagination-content">
    <li><a data-slot="pagination-link" data-active="true" href="#">1</a></li>
    <li><a data-slot="pagination-link" href="#">2</a></li>
    <li><span data-slot="pagination-ellipsis">…</span></li>
    <li><a data-slot="pagination-link" href="#">9</a></li>
    <li><a data-slot="pagination-next" href="#">Next →</a></li>
  </ul>
</nav>
```

---

### 5.12 Alert
**Type**: CSS-only  
**Variants**: `default`, `destructive`

```html
<div data-slot="alert" data-variant="default">
  <h4 data-slot="alert-title">Note</h4>
  <p data-slot="alert-description">This is an informational alert.</p>
</div>
```

---

### 5.13 Progress
**Type**: CSS-only

```html
<div data-slot="progress">
  <div data-slot="progress-indicator" style="width:60%"></div>
</div>
```

---

### 5.14 Aspect-Ratio
**Type**: CSS-only

```html
<div data-slot="aspect-ratio" style="--aspect-ratio:16/9">
  <img src="photo.jpg" alt="Photo" />
</div>
```

---

### 5.15 Avatar
**Type**: JS-enhanced — `avatar.js`

```html
<span data-sc="avatar" data-slot="avatar">
  <img data-slot="avatar-image" src="user.jpg" alt="User" />
  <span data-slot="avatar-fallback">AB</span>
</span>
```

---

### 5.16 Image With Fallback
**Type**: JS-enhanced — `image-with-fallback.js`

```html
<div data-sc="image-with-fallback">
  <img data-slot="image" src="photo.jpg" alt="Photo" />
</div>
```

---

### 5.17 Accordion
**Type**: JS-enhanced — `accordion.js`  
**Options**: `data-type="single|multiple"`, `data-default-open` (on items)

```html
<div data-sc="accordion" data-type="single">
  <div data-slot="accordion-item" data-default-open>
    <button data-slot="accordion-trigger">Section 1</button>
    <div data-slot="accordion-content">Content 1…</div>
  </div>
  <div data-slot="accordion-item">
    <button data-slot="accordion-trigger">Section 2</button>
    <div data-slot="accordion-content">Content 2…</div>
  </div>
</div>
```

---

### 5.18 Collapsible
**Type**: JS-enhanced — `collapsible.js`

```html
<div data-sc="collapsible">
  <button data-slot="collapsible-trigger">Toggle</button>
  <div data-slot="collapsible-content">Hidden content…</div>
</div>
```

---

### 5.19 Tabs
**Type**: JS-enhanced — `tabs.js`  
**Options**: `data-default-value="tab1"`

```html
<div data-sc="tabs" data-default-value="tab1">
  <div data-slot="tabs-list">
    <button data-slot="tabs-trigger" data-value="tab1">Tab 1</button>
    <button data-slot="tabs-trigger" data-value="tab2">Tab 2</button>
  </div>
  <div data-slot="tabs-content" data-value="tab1">Content for tab 1</div>
  <div data-slot="tabs-content" data-value="tab2">Content for tab 2</div>
</div>
```

---

### 5.20 Toggle
**Type**: JS-enhanced — `toggle.js`  
**Variants**: `default`, `outline`  
**Sizes**: `default`, `sm`, `lg`

```html
<button data-sc="toggle" data-slot="toggle" data-variant="outline">
  Bold
</button>
```

---

### 5.21 Toggle Group
**Type**: JS-enhanced — `toggle-group.js`  
**Options**: `data-type="single|multiple"`

```html
<div data-sc="toggle-group" data-type="single">
  <button data-slot="toggle-group-item" data-value="left">Left</button>
  <button data-slot="toggle-group-item" data-value="center">Center</button>
  <button data-slot="toggle-group-item" data-value="right">Right</button>
</div>
```

---

### 5.22 Checkbox
**Type**: JS-enhanced — `checkbox.js`  
**Options**: `data-name="fieldName"`, `data-checked="true"`

```html
<label style="display:flex;align-items:center;gap:8px">
  <button data-sc="checkbox" data-slot="checkbox" data-name="agree"></button>
  I agree to the terms
</label>
```

---

### 5.23 Radio Group
**Type**: JS-enhanced — `radio-group.js`  
**Options**: `data-name="fieldName"`, `data-default-value="val"`

```html
<div data-sc="radio-group" data-name="plan" data-default-value="free">
  <label style="display:flex;align-items:center;gap:8px">
    <button data-slot="radio-group-item" data-value="free"></button>
    Free
  </label>
  <label style="display:flex;align-items:center;gap:8px">
    <button data-slot="radio-group-item" data-value="pro"></button>
    Pro
  </label>
</div>
```

---

### 5.24 Switch
**Type**: JS-enhanced — `switch.js`  
**Options**: `data-name="fieldName"`, `data-checked="true"`

```html
<label style="display:flex;align-items:center;gap:8px">
  <button data-sc="switch" data-slot="switch" data-name="notifications"></button>
  Enable notifications
</label>
```

---

### 5.25 Tooltip
**Type**: JS-enhanced — `tooltip.js`  
**Options**: `data-side="top|bottom|left|right"`, `data-delay="500"`

```html
<span data-sc="tooltip">
  <button data-slot="tooltip-trigger">Hover me</button>
  <div data-slot="tooltip-content">Helpful tip text</div>
</span>
```

---

### 5.26 Hover Card
**Type**: JS-enhanced — `hover-card.js`  
**Options**: `data-side`, `data-open-delay="500"`, `data-close-delay="300"`

```html
<span data-sc="hover-card">
  <a data-slot="hover-card-trigger" href="#">@username</a>
  <div data-slot="hover-card-content">
    <p>Rich profile card content…</p>
  </div>
</span>
```

---

### 5.27 Dialog
**Type**: JS-enhanced — `dialog.js`  
Uses native `<dialog>`. Backdrop-click and Escape close it.

```html
<div data-sc="dialog">
  <button data-slot="dialog-trigger">Open Dialog</button>
  <dialog data-slot="dialog-content">
    <div data-slot="dialog-header">
      <h2 data-slot="dialog-title">My Dialog</h2>
      <p data-slot="dialog-description">Description text.</p>
    </div>
    <div data-slot="dialog-body">
      <p>Dialog body content.</p>
    </div>
    <div data-slot="dialog-footer">
      <button data-slot="dialog-close" data-slot-btn="button" data-variant="outline">Cancel</button>
      <button data-slot="button" data-variant="default">Save</button>
    </div>
  </dialog>
</div>
```

---

### 5.28 Alert Dialog
**Type**: JS-enhanced — `alert-dialog.js`  
Like dialog, but **no backdrop close** and **no Escape close**. User must pick an action.

```html
<div data-sc="alert-dialog">
  <button data-slot="alert-dialog-trigger">Delete</button>
  <dialog data-slot="alert-dialog-content">
    <div data-slot="alert-dialog-header">
      <h2 data-slot="alert-dialog-title">Are you sure?</h2>
      <p data-slot="alert-dialog-description">This action cannot be undone.</p>
    </div>
    <div data-slot="alert-dialog-footer">
      <button data-slot="alert-dialog-cancel" data-variant="outline">Cancel</button>
      <button data-slot="alert-dialog-action" data-variant="destructive">Delete</button>
    </div>
  </dialog>
</div>
```

---

### 5.29 Sheet (Side Panel)
**Type**: JS-enhanced — `sheet.js`  
**Options**: `data-side="right|left|top|bottom"`

```html
<div data-sc="sheet" data-side="right">
  <button data-slot="sheet-trigger">Open Panel</button>
  <dialog data-slot="sheet-content">
    <div data-slot="sheet-header">
      <h2 data-slot="sheet-title">Settings</h2>
    </div>
    <div data-slot="sheet-body">…</div>
    <div data-slot="sheet-footer">
      <button data-slot="sheet-close">Done</button>
    </div>
  </dialog>
</div>
```

---

### 5.30 Drawer (Bottom Sheet)
**Type**: JS-enhanced — `drawer.js`  
**Options**: `data-dismiss-threshold="0.4"`. Has drag-to-dismiss.

```html
<div data-sc="drawer">
  <button data-slot="drawer-trigger">Open Drawer</button>
  <dialog data-slot="drawer-content">
    <div data-slot="drawer-handle"></div>
    <div data-slot="drawer-header">
      <h2 data-slot="drawer-title">Filters</h2>
    </div>
    <div data-slot="drawer-body">…</div>
    <div data-slot="drawer-footer">
      <button data-slot="drawer-close">Apply</button>
    </div>
  </dialog>
</div>
```

---

### 5.31 Dropdown Menu
**Type**: JS-enhanced — `dropdown-menu.js`  
**Options**: `data-side`, `data-align="start|center|end"`

```html
<div data-sc="dropdown-menu">
  <button data-slot="dropdown-menu-trigger">Actions ▾</button>
  <div data-slot="dropdown-menu-content">
    <div data-slot="dropdown-menu-label">Actions</div>
    <button data-slot="dropdown-menu-item">Edit</button>
    <button data-slot="dropdown-menu-item">Duplicate</button>
    <div data-slot="dropdown-menu-separator"></div>
    <button data-slot="dropdown-menu-item" disabled>Delete</button>
  </div>
</div>
```

**Checkbox items:** `<button data-slot="dropdown-menu-checkbox-item" data-checked="true">Show Grid</button>`

**Sub-menus:**
```html
<div data-slot="dropdown-menu-sub">
  <button data-slot="dropdown-menu-sub-trigger">More ▸</button>
  <div data-slot="dropdown-menu-sub-content">
    <button data-slot="dropdown-menu-item">Sub-item</button>
  </div>
</div>
```

---

### 5.32 Context Menu
**Type**: JS-enhanced — `context-menu.js`  
Same item slots as dropdown-menu, triggered by right-click.

```html
<div data-sc="context-menu">
  <div data-slot="context-menu-trigger" style="padding:40px;border:1px dashed var(--border)">
    Right-click here
  </div>
  <div data-slot="context-menu-content">
    <button data-slot="context-menu-item">Cut</button>
    <button data-slot="context-menu-item">Copy</button>
    <button data-slot="context-menu-item">Paste</button>
  </div>
</div>
```

---

### 5.33 Popover
**Type**: JS-enhanced — `popover.js`  
**Options**: `data-side`, `data-align`

```html
<div data-sc="popover">
  <button data-slot="popover-trigger">Options</button>
  <div data-slot="popover-content">
    <p>Popover body with any content.</p>
  </div>
</div>
```

---

### 5.34 Select
**Type**: JS-enhanced — `select.js`  
**Options**: `data-placeholder`, `data-default-value`, `data-name`

```html
<div data-sc="select" data-name="color" data-placeholder="Choose…">
  <button data-slot="select-trigger">
    <span data-slot="select-value">Choose…</span>
  </button>
  <div data-slot="select-content">
    <div data-slot="select-group">
      <div data-slot="select-label">Colors</div>
      <div data-slot="select-item" data-value="red" tabindex="0">Red</div>
      <div data-slot="select-item" data-value="blue" tabindex="0">Blue</div>
      <div data-slot="select-item" data-value="green" tabindex="0">Green</div>
    </div>
  </div>
</div>
```

---

### 5.35 Slider
**Type**: JS-enhanced — `slider.js`  
**Options**: `data-min`, `data-max`, `data-step`, `data-value`, `data-name`, `data-orientation`

```html
<div data-sc="slider" data-min="0" data-max="100" data-step="1" data-value="50" data-name="volume">
  <div data-slot="slider-track">
    <div data-slot="slider-range"></div>
  </div>
  <div data-slot="slider-thumb" tabindex="0"></div>
</div>
```

---

### 5.36 Navigation Menu
**Type**: JS-enhanced — `navigation-menu.js`

```html
<nav data-sc="navigation-menu">
  <ul data-slot="navigation-menu-list">
    <li data-slot="navigation-menu-item">
      <button data-slot="navigation-menu-trigger">Products</button>
      <div data-slot="navigation-menu-content">
        <a data-slot="navigation-menu-link" href="#">Analytics</a>
        <a data-slot="navigation-menu-link" href="#">API</a>
      </div>
    </li>
    <li data-slot="navigation-menu-item">
      <a data-slot="navigation-menu-link" href="#">Pricing</a>
    </li>
  </ul>
</nav>
```

---

### 5.37 Menubar
**Type**: JS-enhanced — `menubar.js`

```html
<div data-sc="menubar">
  <div data-slot="menubar-menu">
    <button data-slot="menubar-trigger">File</button>
    <div data-slot="menubar-content">
      <button data-slot="menubar-item">New</button>
      <button data-slot="menubar-item">Open</button>
      <div data-slot="menubar-separator"></div>
      <button data-slot="menubar-item">Quit</button>
    </div>
  </div>
  <div data-slot="menubar-menu">
    <button data-slot="menubar-trigger">Edit</button>
    <div data-slot="menubar-content">
      <button data-slot="menubar-item">Undo</button>
      <button data-slot="menubar-item">Redo</button>
    </div>
  </div>
</div>
```

---

### 5.38 Carousel
**Type**: JS-enhanced — `carousel.js`  
**Options**: `data-orientation`, `data-loop`, `data-auto-play="3000"`

```html
<div data-sc="carousel">
  <div data-slot="carousel-content">
    <div data-slot="carousel-item">Slide 1</div>
    <div data-slot="carousel-item">Slide 2</div>
    <div data-slot="carousel-item">Slide 3</div>
  </div>
  <button data-slot="carousel-previous">‹</button>
  <button data-slot="carousel-next">›</button>
</div>
```

---

### 5.39 Calendar
**Type**: JS-enhanced — `calendar.js`  
Self-renders. **Options**: `data-value`, `data-min`, `data-max`, `data-locale`, `data-name`

```html
<div data-sc="calendar" data-name="date" data-value="2025-03-15"></div>
```

---

### 5.40 Command (Search Palette)
**Type**: JS-enhanced — `command.js`

```html
<div data-sc="command">
  <div data-slot="command-input-wrapper">
    <input data-slot="command-input" placeholder="Search…" />
  </div>
  <div data-slot="command-list">
    <div data-slot="command-empty" hidden>No results.</div>
    <div data-slot="command-group">
      <div data-slot="command-group-heading">Suggestions</div>
      <button data-slot="command-item" data-value="calendar">Calendar</button>
      <button data-slot="command-item" data-value="search">Search</button>
    </div>
  </div>
</div>
```

---

### 5.41 Form (Validation)
**Type**: JS-enhanced — `form.js`  
Uses native HTML validation (`required`, `type="email"`, `minlength`, etc.).

```html
<form data-sc="form">
  <div data-slot="form-item">
    <label data-slot="form-label" for="email">Email</label>
    <input data-slot="form-control" id="email" name="email" type="email" required />
    <p data-slot="form-description">We'll never share this.</p>
    <p data-slot="form-message" hidden></p>
  </div>
  <button data-slot="button" type="submit">Submit</button>
</form>
```

---

### 5.42 Input OTP
**Type**: JS-enhanced — `input-otp.js`  
Self-renders. **Options**: `data-length`, `data-separator`, `data-pattern`, `data-name`

```html
<div data-sc="input-otp" data-length="6" data-separator="3" data-name="code">
  <div data-slot="input-otp-group"></div>
</div>
```

---

### 5.43 Sidebar
**Type**: JS-enhanced — `sidebar.js`  
**Options**: `data-side`, `data-collapsible="icon|offcanvas|none"`, `data-default-open`

> **Important**: `data-slot="sidebar-trigger"` must be a **direct child** of the sidebar wrapper (not inside `sidebar-panel`). If placed inside the panel, it disappears when collapsed. Use `el._sidebar.toggle()` on a visible button instead.

```html
<div data-sc="sidebar" data-side="left" data-collapsible="offcanvas" data-default-open="true">
  <aside data-slot="sidebar-panel">
    <div data-slot="sidebar-header">
      <span>App Name</span>
      <button onclick="this.closest('[data-sc=sidebar]')._sidebar.toggle()">✕</button>
    </div>
    <nav data-slot="sidebar-content">
      <div data-slot="sidebar-group">
        <div data-slot="sidebar-group-label">Navigation</div>
        <ul data-slot="sidebar-group-content">
          <li data-slot="sidebar-menu-item">
            <a data-slot="sidebar-menu-button" href="#" data-active="true">Home</a>
          </li>
          <li data-slot="sidebar-menu-item">
            <a data-slot="sidebar-menu-button" href="#">Settings</a>
          </li>
        </ul>
      </div>
    </nav>
    <div data-slot="sidebar-footer">v1.0</div>
  </aside>
  <button data-slot="sidebar-trigger" style="display:none"></button>
  <main data-slot="sidebar-inset">
    <header style="padding:8px 16px;border-bottom:1px solid var(--border)">
      <button onclick="document.querySelector('[data-sc=sidebar]')._sidebar.toggle()">☰</button>
    </header>
    <div>…page content…</div>
  </main>
</div>
```

#### Dynamic Content Loading Pattern

Use the sidebar as a persistent shell and swap `sidebar-inset` content dynamically:

```js
fetch('other-page.html')
  .then(r => r.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.getElementById('page-content').innerHTML =
      doc.querySelector('main').innerHTML;
    Scooter.init(document.getElementById('page-content'));
  });
```

> **Script loading rule**: `innerHTML` does NOT execute `<script>` tags. All component scripts needed by dynamically loaded pages must be pre-loaded as `<script>` tags in the shell page. Page-specific inline logic must be wired manually after injection.

Use `Scooter.observe()` to auto-initialize components in dynamically added DOM.

---

### 5.44 Chart
**Type**: JS-enhanced — `chart.js`  
**Options**: `data-type="bar|line|area|pie|donut"`, `data-height`, `data-show-grid`, `data-show-legend`, `data-show-values`, `data-stacked`

Lightweight SVG charting. Uses `--chart-1`…`--chart-5` from `custom.css`. Built-in tooltip on hover.

```html
<div data-sc="chart" data-type="bar" data-height="300">
  <script type="application/json">
    {
      "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      "datasets": [
        { "label": "Revenue", "values": [4200, 6500, 5100, 8000, 6200, 9100] },
        { "label": "Expenses", "values": [3100, 4200, 3500, 5000, 4500, 5500] }
      ]
    }
  </script>
</div>
```

**Chart types**: `bar` (add `data-stacked="true"` for stacked), `line`, `area`, `pie`, `donut`

**API** (`el._chart`): `setData(data)`, `getData()`, `render()`, `destroy()`

**Event**: `sc:hover` → `{ index, label, values }`

---

### 5.45 Resizable (Split Panes)
**Type**: JS-enhanced — `resizable.js`  
**Options**: `data-direction="horizontal|vertical"`, `data-default-size`, `data-min-size`, `data-max-size`

```html
<div data-sc="resizable" data-direction="horizontal" style="height:400px">
  <div data-slot="resizable-panel" data-default-size="60">Left pane</div>
  <div data-slot="resizable-handle"></div>
  <div data-slot="resizable-panel" data-default-size="40">Right pane</div>
</div>
```

---

### 5.46 Scroll Area
**Type**: JS-enhanced — `scroll-area.js`  
**Options**: `data-orientation="vertical|horizontal|both"`

```html
<div data-sc="scroll-area" data-orientation="vertical" style="height:300px">
  <div data-slot="scroll-area-viewport">
    …long scrollable content…
  </div>
</div>
```

---

### 5.47 Toast (Imperative)
**Type**: JS-enhanced — `toast.js`  
Called from JavaScript, not from markup:

```js
Scooter.toast('Saved!');
Scooter.toast('Error occurred', {
  variant: 'destructive',
  description: 'Network connection failed.',
  duration: 5000
});
Scooter.toast('Item deleted', {
  action: () => undoDelete(),
  actionLabel: 'Undo'
});
```

Position container (optional):
```html
<div data-slot="toast-container" data-position="top-right"></div>
```

---

## 6. Events Reference

All JS-enhanced components dispatch custom events on their `data-sc` root element:

| Component | Event | `detail` |
|---|---|---|
| Accordion | `sc:toggle` | `{ value, open }` |
| Tabs | `sc:change` | selected value string |
| Toggle | `sc:toggle` | `{ pressed }` |
| Toggle Group | `sc:change` | selected value(s) |
| Checkbox | `sc:change` | `{ checked }` |
| Radio Group | `sc:change` | selected value |
| Switch | `sc:change` | `{ checked }` |
| Select | `sc:change` | selected value |
| Slider | `sc:change` | numeric value |
| Calendar | `sc:change` | date string `"YYYY-MM-DD"` |
| Command | `sc:select` | selected value |
| Dropdown Menu | `sc:select` | item label |
| Context Menu | `sc:select` | item label |
| Alert Dialog | `sc:action` | — |
| Input OTP | `sc:complete` | full code string |
| Carousel | `sc:slide` | slide index |
| Chart | `sc:hover` | `{ index, label, values }` |
| Sidebar | `sc:toggle` | boolean open state |

```js
document.querySelector('[data-sc="tabs"]').addEventListener('sc:change', (e) => {
  console.log('Tab changed to:', e.detail);
});
```

---

## 7. Programmatic API

Every JS component exposes its API on `el._componentName`:

```js
document.querySelector('[data-sc="dialog"]')._dialog.open();
document.querySelector('[data-sc="slider"]')._slider.setValue(75);
document.querySelector('[data-sc="calendar"]')._calendar.getValue();
document.querySelector('[data-sc="chart"]')._chart.setData(newData);
document.querySelector('[data-sc="sidebar"]')._sidebar.toggle();
Scooter.toast('Hello!');
```

---

## 8. Icons

`scooter-core.js` provides SVG icons at `Scooter.icons`:

```js
Scooter.icons.chevronDown   // SVG string
Scooter.icons.x             // Close icon
Scooter.icons.check         // Checkmark
Scooter.icons.search        // Search
Scooter.icons.circle        // Filled circle
Scooter.icons.pin           // Pin/map icon
Scooter.icons.globe         // Globe icon
```

For additional icons, use inline SVGs from Lucide, Heroicons, etc.

---

## 9. Responsive Design

Built-in breakpoints in `base.css`:
- `@media (max-width: 768px)` — tablet
- `@media (max-width: 480px)` — mobile

Auto-responsive: tables scroll horizontally, cards auto-stack, navigation adapts.

---

## 10. Accessibility

- Semantic HTML (`<nav>`, `<main>`, `<button>`, `<dialog>`)
- ARIA attributes auto-managed by JS components
- Color contrast ≥ 4.5:1 (the token palette meets this)
- Full keyboard navigation (Tab, arrows, Escape, Enter)
- `2px solid var(--ring)` focus ring via base.css
- Native `<dialog>` for built-in focus trapping

---

## 11. Animations

Defined keyframes (auto-applied by components):
`fadeIn`, `fadeOut`, `slideDown`, `slideUp`, `zoomIn95`, `zoomOut95`, `accordionDown`, `accordionUp`, `toastSlideIn`

Duration tokens: `--duration-fast` (200ms), `--duration-normal` (300ms), `--duration-slow` (500ms).

---

## 12. Example Pages (for reference)

The `demo-pages/` folder contains working demos. The `pages/` folder is for new pages.

| File | What it demonstrates |
|---|---|
| `demo-pages/demo-css-only.html` | All CSS-only components (buttons, cards, badges, tables, etc.) |
| `demo-pages/demo-light-js.html` | Simple JS components (accordion, tabs, toggle, checkbox, switch) |
| `demo-pages/demo-medium-js.html` | Intermediate JS (dialog, dropdown, select, slider, calendar) |
| `demo-pages/demo-complex-js.html` | Advanced JS (command palette, menubar, carousel, OTP, form validation) |
| `demo-pages/demo-patterns.html` | Integration patterns: forms, token gallery, card grids, event logger |
| `demo-pages/demo-dashboard.html` | Dashboard with KPI cards, charts, tables, period toggle |
| `demo-pages/demo-sidebar-dynamic.html` | Sidebar shell with dynamic page loading |
| `demo-pages/demo.css` | Shared styles for demo pages (optional — not required for production pages) |
| `pages/_template/index.html` | **Starter template** — copy this folder for new pages |

Use these as living references. Open them in a browser to see the components in action.

---

## 13. Quick Recipe — Full Example Page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <link rel="stylesheet" href="../components.css" />
</head>
<body>
  <div class="page">
    <header class="header">
      <h1>Dashboard</h1>
    </header>
    <main class="container">

      <!-- Stats cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;margin-bottom:32px">
        <div data-slot="card">
          <div data-slot="card-header">
            <p data-slot="card-description">Total Users</p>
            <h3 data-slot="card-title">2,350</h3>
          </div>
          <div data-slot="card-content">
            <div data-slot="progress"><div data-slot="progress-indicator" style="width:73%"></div></div>
          </div>
        </div>
      </div>

      <!-- Tabs with table -->
      <div data-sc="tabs" data-default-value="recent">
        <div data-slot="tabs-list">
          <button data-slot="tabs-trigger" data-value="recent">Recent</button>
          <button data-slot="tabs-trigger" data-value="popular">Popular</button>
        </div>
        <div data-slot="tabs-content" data-value="recent">
          <div data-slot="table-container">
            <table data-slot="table">
              <thead>
                <tr data-slot="table-row">
                  <th data-slot="table-head">Name</th>
                  <th data-slot="table-head">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr data-slot="table-row">
                  <td data-slot="table-cell">Project Alpha</td>
                  <td data-slot="table-cell"><span data-slot="badge">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div data-slot="tabs-content" data-value="popular">
          <p>Popular items go here.</p>
        </div>
      </div>

      <!-- Chart -->
      <div data-sc="chart" data-type="area" data-height="280">
        <script type="application/json">
          {
            "labels": ["Jan","Feb","Mar","Apr","May","Jun"],
            "datasets": [{ "label": "Users", "values": [820,932,1100,1250,1340,1429] }]
          }
        </script>
      </div>

    </main>
  </div>

  <script src="../components/scooter-core.js"></script>
  <script src="../components/tabs.js"></script>
  <script src="../components/chart.js"></script>
</body>
</html>
```

---

## 14. Do's and Don'ts

### Do
- Reference design tokens (`var(--primary)`) — never hardcode colors
- Use `data-slot` for all component parts, `data-sc` on interactive component roots
- Keep new pages in the `pages/` folder
- Only load scripts for components actually used on the page
- Edit `custom.css` for theming — it's the single source for visual tokens
- Use semantic HTML elements
- Check the demo pages for working examples before building new ones

### Don't
- Don't use Tailwind utility classes — this system uses semantic CSS
- Don't add a build step, bundler, or any framework
- Don't modify `base.css` for per-page styling — use a `<style>` block
- Don't hardcode colors — always use CSS variables from `custom.css`
- Don't forget `scooter-core.js` before other component scripts
- Don't place `sidebar-trigger` inside `sidebar-panel` (it will disappear when collapsed)