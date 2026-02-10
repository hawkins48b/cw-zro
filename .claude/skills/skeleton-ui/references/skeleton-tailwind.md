# Skeleton v4 — Tailwind Components & CSS Classes

These are CSS utility classes — no JavaScript imports needed. Apply directly to HTML elements.

## Buttons

| Class | Description |
|-------|-------------|
| `btn` | Standard button |
| `btn-icon` | Icon-only button (square) |
| `btn-group` | Button group container |
| `btn-sm` | Small size |
| `btn-base` | Base size (default) |
| `btn-lg` | Large size |

### Button Examples

```html
<!-- Filled -->
<button class="btn preset-filled-primary-500">Primary</button>
<button class="btn preset-filled-secondary-500">Secondary</button>
<button class="btn preset-filled-error-500">Danger</button>

<!-- Tonal -->
<button class="btn preset-tonal-primary">Tonal Primary</button>

<!-- Outlined -->
<button class="btn preset-outlined-primary-500">Outlined</button>

<!-- Icon button -->
<button class="btn-icon preset-filled-primary-500" title="Add">
  <PlusIcon size={18} />
</button>

<!-- Button with icon and text -->
<button class="btn preset-filled-primary-500">
  <PlusIcon size={18} />
  <span>Add Profile</span>
</button>

<!-- Button group -->
<nav class="btn-group preset-outlined-surface-200-800">
  <button class="btn preset-filled">MOA</button>
  <button class="btn">MRAD</button>
</nav>

<!-- Disabled -->
<button class="btn preset-filled-primary-500" disabled>Disabled</button>
```

## Cards

| Class | Description |
|-------|-------------|
| `card` | Card container |

### Card Examples

```html
<!-- Basic card -->
<div class="card preset-filled-surface-100-900 p-4">
  <p>Content</p>
</div>

<!-- Card with sections -->
<div class="card preset-filled-surface-100-900">
  <header class="p-4 border-b border-surface-200-800">
    <h3 class="h3">Title</h3>
  </header>
  <article class="p-4">Content</article>
  <footer class="p-4 border-t border-surface-200-800 flex gap-2">
    <button class="btn preset-filled-primary-500">Save</button>
    <button class="btn preset-tonal-surface">Cancel</button>
  </footer>
</div>

<!-- Outlined card -->
<div class="card preset-outlined-surface-200-800 p-4">Content</div>

<!-- Tonal card -->
<div class="card preset-tonal-primary p-4">Content</div>
```

## Badges

| Class | Description |
|-------|-------------|
| `badge` | Inline badge element |

```html
<span class="badge preset-filled-primary-500">New</span>
<span class="badge preset-filled-success-500">Active</span>
<span class="badge preset-filled-error-500">Error</span>
<span class="badge preset-tonal-warning">Warning</span>
```

## Chips

| Class | Description |
|-------|-------------|
| `chip` | Chip/tag element |

```html
<span class="chip preset-filled-primary-500">Tag</span>
<span class="chip preset-tonal-secondary">Category</span>
<span class="chip preset-outlined-surface-200-800">Filter</span>
```

## Forms & Inputs

**Requires**: `@tailwindcss/forms` plugin

| Class | Description |
|-------|-------------|
| `label` | Label container |
| `label-text` | Label text |
| `input` | Text input |
| `select` | Select dropdown |
| `textarea` | Multi-line text |
| `checkbox` | Checkbox |
| `radio` | Radio button |
| `input-group` | Input group container |
| `ig-cell` | Input group text/icon cell |
| `ig-input` | Input group text input |
| `ig-select` | Input group select |
| `ig-btn` | Input group button |

### Form Examples

```html
<!-- Text input -->
<label class="label">
  <span class="label-text">Muzzle Velocity</span>
  <input class="input" type="number" placeholder="fps" />
</label>

<!-- Select -->
<label class="label">
  <span class="label-text">Unit System</span>
  <select class="select">
    <option value="imperial">Imperial</option>
    <option value="metric">Metric</option>
  </select>
</label>

<!-- Textarea -->
<label class="label">
  <span class="label-text">Notes</span>
  <textarea class="textarea" rows="3"></textarea>
</label>

<!-- Checkbox -->
<label class="flex items-center gap-2">
  <input class="checkbox" type="checkbox" />
  <span>Include spin drift</span>
</label>

<!-- Radio -->
<label class="flex items-center gap-2">
  <input class="radio" type="radio" name="unit" value="moa" />
  <span>MOA</span>
</label>

<!-- Input group -->
<div class="input-group preset-outlined-surface-200-800">
  <span class="ig-cell">Range</span>
  <input class="ig-input" type="number" value="100" />
  <select class="ig-select">
    <option>yd</option>
    <option>m</option>
  </select>
</div>
```

## Tables

| Class | Description |
|-------|-------------|
| `table-wrap` | Scrollable table container |
| `table` | Table element |

```html
<div class="table-wrap">
  <table class="table">
    <thead>
      <tr>
        <th>Range (yd)</th>
        <th>Drop (in)</th>
        <th>Elevation (MOA)</th>
        <th>Wind (MOA)</th>
        <th>Velocity (fps)</th>
        <th>Energy (ft-lbs)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>100</td>
        <td>-1.5</td>
        <td>0.0</td>
        <td>0.5</td>
        <td>2800</td>
        <td>2100</td>
      </tr>
    </tbody>
  </table>
</div>
```

## Dividers

| Class | Description |
|-------|-------------|
| `hr` | Horizontal rule |
| `divider` | Divider line |

```html
<hr class="divider" />
```

## Placeholders

| Class | Description |
|-------|-------------|
| `placeholder` | Loading placeholder |
| `placeholder-circle` | Circular placeholder |

```html
<div class="placeholder animate-pulse"></div>
<div class="placeholder-circle w-16 animate-pulse"></div>
```

## Typography Classes

Skeleton provides semantic HTML utility classes:

| Class | Element |
|-------|---------|
| `h1` — `h6` | Heading sizes |
| `p` | Paragraph |
| `blockquote` | Block quote |
| `code` | Inline code |
| `kbd` | Keyboard key |
| `pre` | Preformatted |
| `anchor` | Styled link |

```html
<h1 class="h1">Page Title</h1>
<h2 class="h2">Section</h2>
<p class="text-surface-400">Description text</p>
<code class="code">value</code>
<kbd class="kbd">Ctrl+S</kbd>
```

## Surface Colors

Common surface utilities for text/backgrounds:

```
bg-surface-50-950    (lightest in light mode, darkest in dark mode)
bg-surface-100-900
bg-surface-200-800
bg-surface-300-700
bg-surface-400-600
bg-surface-500
text-surface-400     (muted text)
border-surface-200-800
```
