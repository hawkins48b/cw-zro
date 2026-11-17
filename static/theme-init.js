// Applies the dark theme before the first paint, so the page does not flash light.
// A file, not an inline script: the Content-Security-Policy (#104) allows only the
// inline scripts SvelteKit hashes, and it does not hash the ones in app.html.
(function () {
	var stored = null;
	try {
		stored = localStorage.getItem('zro-dark-mode');
	} catch (error) {
		// Storage blocked: follow the system setting.
	}
	var dark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
	if (dark) document.documentElement.classList.add('dark');
})();
