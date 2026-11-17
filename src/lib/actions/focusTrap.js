/**
 * Keeps keyboard focus inside a dialog while it is open (#166).
 *
 * On mount it moves focus to the first element marked `data-autofocus`, else the first focusable
 * element, else the node itself (give it tabindex="-1"). Tab and Shift+Tab wrap inside the node.
 * Escape calls `onescape`. On destroy, focus goes back to the element that had it before the dialog
 * opened (the button that opened it), when that element is still in the page.
 *
 * Usage: <div role="dialog" aria-modal="true" tabindex="-1" use:focusTrap={{ onescape: close }}>
 *
 * @param {HTMLElement} node
 * @param {{ onescape?: () => void, returnTo?: HTMLElement | null }} [options]
 */
export function focusTrap(node, options = {}) {
	let opts = options;
	const before = /** @type {HTMLElement | null} */ (opts.returnTo ?? document.activeElement);

	const SELECTOR = [
		'a[href]',
		'button:not([disabled])',
		'input:not([disabled]):not([type="hidden"])',
		'select:not([disabled])',
		'textarea:not([disabled])',
		'[tabindex]:not([tabindex="-1"])'
	].join(',');

	/** Focusable elements that are shown (an element hidden by CSS has no client rects). */
	function focusables() {
		return /** @type {HTMLElement[]} */ ([...node.querySelectorAll(SELECTOR)]).filter(
			(el) => el.getClientRects().length > 0
		);
	}

	queueMicrotask(() => {
		const first = /** @type {HTMLElement | null} */ (node.querySelector('[data-autofocus]')) ?? focusables()[0] ?? node;
		first.focus();
	});

	/** @param {KeyboardEvent} e */
	function onkeydown(e) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			opts.onescape?.();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = focusables();
		if (items.length === 0) {
			e.preventDefault();
			node.focus();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === node)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', onkeydown);

	return {
		/** @param {{ onescape?: () => void }} next */
		update(next) {
			opts = next ?? {};
		},
		destroy() {
			node.removeEventListener('keydown', onkeydown);
			if (before && before.isConnected) before.focus();
		}
	};
}
