# Svelte 5 Runes — Detailed Reference

## $state

Declares reactive state. Replaces `let` for reactive variables.

```svelte
<script>
  let count = $state(0);
  let user = $state({ name: 'John', age: 30 });
  let items = $state([1, 2, 3]);

  // Deep reactivity — mutations are tracked
  function addItem() {
    items.push(4); // This triggers reactivity
  }

  function updateName() {
    user.name = 'Jane'; // This triggers reactivity
  }
</script>
```

### $state.raw

For large arrays/objects where you replace (not mutate), use `$state.raw` for better performance:

```svelte
<script>
  let items = $state.raw([]);

  // Must replace, not mutate
  function addItem(item) {
    items = [...items, item]; // OK
    // items.push(item); // Won't trigger updates
  }
</script>
```

### $state.snapshot

Get a plain (non-reactive) copy of state:

```js
let snapshot = $state.snapshot(reactiveObject);
console.log(snapshot); // Plain object, safe for JSON.stringify
```

## $derived

Computed values that auto-update when dependencies change.

```svelte
<script>
  let width = $state(10);
  let height = $state(20);

  // Simple expression
  let area = $derived(width * height);

  // Complex logic with $derived.by
  let description = $derived.by(() => {
    if (area > 100) return 'Large';
    if (area > 50) return 'Medium';
    return 'Small';
  });
</script>
```

## $effect

Side effects that run when dependencies change.

```svelte
<script>
  let count = $state(0);

  // Runs after DOM update when count changes
  $effect(() => {
    document.title = `Count: ${count}`;
  });

  // Cleanup pattern
  $effect(() => {
    const interval = setInterval(() => count++, 1000);
    return () => clearInterval(interval); // Cleanup
  });

  // Pre-effect (runs before DOM update)
  $effect.pre(() => {
    // Runs before DOM updates
  });
</script>
```

### Important $effect Rules

- **Do NOT** set `$state` inside `$effect` if it creates infinite loops
- Use `$derived` when possible instead of `$effect` + `$state` combo
- `$effect` only runs in the browser (not during SSR)
- Cleanup function runs before re-execution and on destroy

## $props

Declare component props. Replaces `export let`.

```svelte
<script>
  // Basic props with defaults
  let { name, count = 0, optional = undefined } = $props();

  // Rest props (for passing to child elements)
  let { class: className, children, ...rest } = $props();
</script>

<div class={className} {...rest}>
  {@render children?.()}
</div>
```

## $bindable

Allow two-way binding on a prop.

```svelte
<!-- TextInput.svelte -->
<script>
  let { value = $bindable('') } = $props();
</script>

<input bind:value />

<!-- Usage -->
<TextInput bind:value={name} />
```

## $inspect (dev only)

Debug reactive values — logs when they change.

```svelte
<script>
  let count = $state(0);
  $inspect(count); // Logs: "init", 0 then "update", 1, etc.
</script>
```

## Snippets & {@render}

Replace slots with snippets:

```svelte
<!-- Defining a snippet -->
{#snippet row(item, index)}
  <tr>
    <td>{index}</td>
    <td>{item.name}</td>
  </tr>
{/snippet}

<!-- Rendering a snippet -->
{@render row(item, i)}

<!-- Conditional rendering -->
{#if header}
  {@render header()}
{/if}
```

### Passing snippets as props

```svelte
<!-- Parent.svelte -->
<DataTable data={items}>
  {#snippet row(item)}
    <td>{item.name}</td>
  {/snippet}
</DataTable>

<!-- DataTable.svelte -->
<script>
  let { data, row } = $props();
</script>

<table>
  {#each data as item}
    <tr>{@render row(item)}</tr>
  {/each}
</table>
```

## Migration from Svelte 4

| Svelte 4 | Svelte 5 |
|-----------|----------|
| `let x = 0` (reactive) | `let x = $state(0)` |
| `$: doubled = x * 2` | `let doubled = $derived(x * 2)` |
| `$: { sideEffect() }` | `$effect(() => { sideEffect() })` |
| `export let prop` | `let { prop } = $props()` |
| `<slot />` | `{@render children()}` |
| `<slot name="header" />` | `{@render header?.()}` |
| `on:click={handler}` | `onclick={handler}` |
| `createEventDispatcher()` | Callback props |
