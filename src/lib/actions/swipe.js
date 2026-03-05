/**
 * Swipe-to-delete action for profile cards.
 * Handles ONLY horizontal swipe — long press is handled separately via usePress.
 *
 * Options:
 *   canSwipe  — enable swipe (default true; pass false for the active card)
 *   ref       — callback(api | null) to receive the imperative handle
 *
 * Dispatches on the node (bubbles: false):
 *   swipedelete  — swipe past threshold; card held at -80 px
 *   swipechange  — { active: boolean } when the red delete-zone background should show/hide
 *
 * Imperative API (via ref):
 *   snapBack()      — animate card back to x = 0
 *   flyOut(onDone)  — animate card off-screen left, then call onDone()
 *
 * Uses touch events (not pointer events) so the browser's scroll detection
 * doesn't fire pointercancel mid-swipe.
 */

const SWIPE_DELETE_THRESHOLD = 60;
const SWIPE_MAX = 100;
const SWIPE_START_THRESHOLD = 6; // px horizontal movement before we start tracking

export function swipe(node, params = {}) {
	let { canSwipe = true, ref } = params;

	let startX = 0;
	let swipeX = 0;
	let swiping = false;
	let bgActive = false;

	// ── Transform ──────────────────────────────────────────────────────────

	function applyTransform(x, transition = 'none') {
		swipeX = x;
		node.style.transition = transition;
		node.style.transform = x !== 0 ? `translateX(${x}px)` : '';
	}

	function setBgActive(active) {
		if (active === bgActive) return;
		bgActive = active;
		node.dispatchEvent(new CustomEvent('swipechange', { detail: { active }, bubbles: false }));
	}

	// ── Touch ──────────────────────────────────────────────────────────────

	function onTouchStart(e) {
		if (!canSwipe) return;
		startX = e.touches[0].clientX;
		swiping = false;
	}

	function onTouchMove(e) {
		if (!canSwipe) return;
		const dx = e.touches[0].clientX - startX;

		if (!swiping) {
			// Only start tracking a clear leftward swipe
			if (dx < -SWIPE_START_THRESHOLD) {
				swiping = true;
				// Clear any scale that might have been applied by the press gesture
				node.style.transition = 'none';
			} else {
				return;
			}
		}

		if (dx < 0) {
			applyTransform(Math.max(dx, -SWIPE_MAX));
			setBgActive(true);
		}
	}

	function onTouchEnd() {
		if (!swiping) return;
		swiping = false;

		if (swipeX < -SWIPE_DELETE_THRESHOLD) {
			applyTransform(-80, 'transform 200ms ease');
			node.dispatchEvent(new CustomEvent('swipedelete', { bubbles: false }));
		} else {
			applyTransform(0, 'transform 300ms ease');
			setBgActive(false);
		}
	}

	function onTouchCancel() {
		if (!swiping) return;
		swiping = false;
		applyTransform(0, 'transform 300ms ease');
		setBgActive(false);
	}

	// ── Imperative API ─────────────────────────────────────────────────────

	const api = {
		snapBack() {
			applyTransform(0, 'transform 300ms ease');
			setBgActive(false);
		},
		flyOut(onDone) {
			applyTransform(-600, 'transform 300ms ease');
			setTimeout(onDone, 300);
		}
	};

	ref?.(api);

	// ── Listeners ──────────────────────────────────────────────────────────

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd);
	node.addEventListener('touchcancel', onTouchCancel);

	return {
		update(newParams) {
			if (!newParams.canSwipe && canSwipe && swiping) {
				swiping = false;
				applyTransform(0, 'transform 300ms ease');
				setBgActive(false);
			}
			canSwipe = newParams.canSwipe ?? true;
			if (newParams.ref !== ref) {
				ref?.(null);
				ref = newParams.ref;
				ref?.(api);
			}
		},
		destroy() {
			ref?.(null);
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);
		}
	};
}
