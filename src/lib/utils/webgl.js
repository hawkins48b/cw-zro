/**
 * Whether the browser can draw the 3D tutorial (#182): a WebGL 2 context on a throwaway canvas.
 * three.js 0.187 draws with WebGL 2 only (it dropped WebGL 1 in r163), so a browser with WebGL 1
 * alone counts as without. The context is released at once (WEBGL_lose_context), so the check holds
 * no GPU memory and does not count against the browser's limit of live contexts.
 *
 * @param {{ createElement: (tag: string) => any }} [doc] - document, or a stand-in in the tests
 * @returns {boolean}
 */
export function hasWebGL(doc = globalThis.document) {
	try {
		const canvas = doc?.createElement?.('canvas');
		if (!canvas?.getContext) return false;
		const gl = canvas.getContext('webgl2');
		if (!gl) return false;
		gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
		return true;
	} catch {
		return false;
	}
}
