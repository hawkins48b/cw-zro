/**
 * Class strings shared by the Settings, About, Privacy and Licences screens (#166), so the cards,
 * section titles and link rows look the same on each.
 */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500';

/** Uppercase section title above a card ("Display", "Data", "Danger zone"). */
export const sectionTitle = 'mx-1 mt-1.5 text-xs font-bold tracking-wider uppercase text-surface-600-400';

/** A plain surface card. */
export const card = 'card preset-filled-surface-100-900 border border-surface-200-800';

/** A full-width link row inside a card: icon, title (and line under it), chevron. */
export const linkRow = `flex items-center gap-3.5 min-h-14 py-2 pl-4 pr-3.5 text-left hover:preset-tonal-surface ${focusRing} focus-visible:-outline-offset-2`;

/** The coloured icon on the left of a link row. */
export const rowIcon = 'size-5 shrink-0 text-primary-700-300';

/** Outlined button or link, 44 px tall. */
export const outlineButton = `btn preset-outlined-surface-300-700 hover:preset-tonal-surface h-11 px-3.5 gap-2 text-sm font-semibold ${focusRing}`;
