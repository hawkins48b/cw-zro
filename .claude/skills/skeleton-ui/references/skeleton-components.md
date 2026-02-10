# Skeleton v4 — Framework Components Reference

All components are imported from `@skeletonlabs/skeleton-svelte`.

## Component Inventory (30 components)

### Layout & Navigation

| Component | Description | Sub-components |
|-----------|-------------|----------------|
| **AppBar** | Page header bar | `.Toolbar`, `.Lead`, `.Headline`, `.Trail` |
| **Navigation** | App navigation (bar/rail/sidebar) | `.Header`, `.Content`, `.Group`, `.Label`, `.Menu`, `.Trigger`, `.TriggerAnchor`, `.TriggerText`, `.Footer` |
| **Tabs** | Tabbed interface | `.List`, `.Trigger`, `.Indicator`, `.Content` |
| **Steps** | Step-by-step wizard | — |

### Data Display

| Component | Description |
|-----------|-------------|
| **Accordion** | Collapsible content sections |
| **Avatar** | User/profile images |
| **Carousel** | Image/content slider |
| **Collapsible** | Toggle content visibility |
| **Progress** | Progress indicators (circular & linear) |
| **Rating Group** | Star/value ratings |
| **Tree View** | Hierarchical data display |
| **Tooltip** | Hover/focus information |

### Forms & Input

| Component | Description |
|-----------|-------------|
| **Combobox** | Searchable select/autocomplete |
| **Date Picker** | Date selection |
| **File Upload** | File input with drag & drop |
| **Listbox** | Selectable list |
| **Segmented Control** | Button group for single selection |
| **Slider** | Range value input |
| **Switch** | Toggle on/off |
| **Tags Input** | Tag/chip input |
| **Toggle Group** | Multi-option toggle |

### Overlays & Feedback

| Component | Description |
|-----------|-------------|
| **Dialog** | Modal/dialog windows |
| **Floating Panel** | Floating container |
| **Menu** | Dropdown/context menu |
| **Popover** | Positioned popover content |
| **Portal** | Render outside DOM tree |
| **Toast** | Notification toasts |
| **Pagination** | Page navigation |

---

## Key Component APIs

### AppBar

```svelte
<script>
  import { AppBar } from '@skeletonlabs/skeleton-svelte';
</script>

<AppBar class="bg-surface-50-950">
  <AppBar.Toolbar class="grid-cols-[auto_1fr_auto]">
    <AppBar.Lead>
      <a href="/" class="flex items-center gap-2">
        <img src="/logo.svg" alt="ZRO" class="h-8" />
      </a>
    </AppBar.Lead>
    <AppBar.Headline class="text-center">
      <h1 class="h4">Page Title</h1>
    </AppBar.Headline>
    <AppBar.Trail>
      <button class="btn-icon preset-tonal-surface">
        <SettingsIcon size={20} />
      </button>
    </AppBar.Trail>
  </AppBar.Toolbar>
</AppBar>
```

### Navigation

```svelte
<script>
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
</script>

<!-- Bottom bar (mobile) -->
<Navigation layout="bar">
  <Navigation.Menu>
    <Navigation.Trigger href="/" title="Dashboard">
      <HomeIcon size={20} />
      <Navigation.TriggerText>Home</Navigation.TriggerText>
    </Navigation.Trigger>
    <Navigation.Trigger href="/profiles" title="Profiles">
      <UserIcon size={20} />
      <Navigation.TriggerText>Profiles</Navigation.TriggerText>
    </Navigation.Trigger>
  </Navigation.Menu>
</Navigation>

<!-- Side rail (tablet) -->
<Navigation layout="rail">
  <Navigation.Header>
    <img src="/logo.svg" alt="ZRO" class="w-8" />
  </Navigation.Header>
  <Navigation.Menu>
    <Navigation.Trigger href="/" title="Dashboard">
      <HomeIcon size={20} />
    </Navigation.Trigger>
  </Navigation.Menu>
  <Navigation.Footer>
    <Navigation.Trigger href="/settings" title="Settings">
      <SettingsIcon size={20} />
    </Navigation.Trigger>
  </Navigation.Footer>
</Navigation>

<!-- Full sidebar (desktop) -->
<Navigation layout="sidebar">
  <Navigation.Header>
    <h2 class="h4">ZRO</h2>
  </Navigation.Header>
  <Navigation.Content>
    <Navigation.Group>
      <Navigation.Label>Calculators</Navigation.Label>
      <Navigation.Menu>
        <Navigation.TriggerAnchor href="/calculators/ballistic">
          Ballistic
        </Navigation.TriggerAnchor>
      </Navigation.Menu>
    </Navigation.Group>
  </Navigation.Content>
</Navigation>
```

**Layout options**: `"bar"` | `"rail"` | `"sidebar"`

### Tabs

```svelte
<script>
  import { Tabs } from '@skeletonlabs/skeleton-svelte';
  let activeTab = $state('trajectory');
</script>

<Tabs value={activeTab} onValueChange={(d) => activeTab = d.value}>
  <Tabs.List>
    <Tabs.Trigger value="trajectory">Trajectory</Tabs.Trigger>
    <Tabs.Trigger value="chart">Chart</Tabs.Trigger>
    <Tabs.Trigger value="dope">Dope Card</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Content value="trajectory">
    <p>Trajectory data...</p>
  </Tabs.Content>
  <Tabs.Content value="chart">
    <p>Chart view...</p>
  </Tabs.Content>
  <Tabs.Content value="dope">
    <p>Dope card...</p>
  </Tabs.Content>
</Tabs>
```

**Props**: `value`, `defaultValue`, `orientation` ("horizontal"|"vertical"), `activationMode` ("automatic"|"manual"), `loopFocus`, `onValueChange`, `onFocusChange`

### Dialog

```svelte
<script>
  import { Dialog } from '@skeletonlabs/skeleton-svelte';
  let open = $state(false);
</script>

<button onclick={() => open = true} class="btn preset-filled-primary-500">
  Open Dialog
</button>

<Dialog {open} onOpenChange={(d) => open = d.open}>
  <Dialog.Positioner>
    <Dialog.Content class="card preset-filled-surface-100-900 p-6 max-w-md">
      <Dialog.Title class="h4">Confirm Delete</Dialog.Title>
      <Dialog.Description>Are you sure?</Dialog.Description>
      <footer class="flex gap-2 justify-end mt-4">
        <button onclick={() => open = false} class="btn preset-tonal-surface">Cancel</button>
        <button onclick={handleDelete} class="btn preset-filled-error-500">Delete</button>
      </footer>
    </Dialog.Content>
  </Dialog.Positioner>
</Dialog>
```

### Accordion

```svelte
<script>
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
</script>

<Accordion>
  <Accordion.Item value="atmosphere">
    <Accordion.ItemTrigger>Atmosphere Settings</Accordion.ItemTrigger>
    <Accordion.ItemContent>
      <!-- Form fields -->
    </Accordion.ItemContent>
  </Accordion.Item>
  <Accordion.Item value="wind">
    <Accordion.ItemTrigger>Wind Conditions</Accordion.ItemTrigger>
    <Accordion.ItemContent>
      <!-- Form fields -->
    </Accordion.ItemContent>
  </Accordion.Item>
</Accordion>
```

### Avatar

```svelte
<Avatar src="/avatar.png" name="John Doe" size="lg" />
```

**Props**: `src`, `name`, `size` ("sm"|"md"|"lg"|"xl")

### Switch

```svelte
<Switch
  checked={darkMode}
  onCheckedChange={(d) => darkMode = d.checked}
>
  Dark Mode
</Switch>
```

### Slider

```svelte
<Slider
  value={[distance]}
  min={0}
  max={2000}
  step={50}
  onValueChange={(d) => distance = d.value[0]}
/>
```

### Toast

```svelte
<script>
  import { Toast } from '@skeletonlabs/skeleton-svelte';
</script>

<!-- Place once in layout -->
<Toast.Provider>
  <Toast.Viewport />
</Toast.Provider>
```

### Combobox

```svelte
<Combobox
  items={ammoOptions}
  value={selectedAmmo}
  onValueChange={(d) => selectedAmmo = d.value}
  placeholder="Search ammo..."
>
  {#snippet item(item)}
    <span>{item.label}</span>
  {/snippet}
</Combobox>
```

### Pagination

```svelte
<Pagination
  count={totalItems}
  pageSize={20}
  page={currentPage}
  onPageChange={(d) => currentPage = d.page}
/>
```
