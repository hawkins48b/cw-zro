// Application menu (#104). Electron's default menu has Reload and Toggle Developer Tools,
// which a packaged app should not offer. Kept free of Electron imports so that it can be
// tested with Vitest; main.js passes the template to Menu.buildFromTemplate.

/**
 * @param {{ isMac: boolean, isPackaged: boolean }} options
 * @returns {object[]} Menu template
 */
export function buildMenuTemplate({ isMac, isPackaged }) {
	const view = [
		{ role: 'resetZoom' },
		{ role: 'zoomIn' },
		{ role: 'zoomOut' },
		{ type: 'separator' },
		{ role: 'togglefullscreen' }
	];
	// Developer tools only in unpackaged runs (npm run electron:dev).
	if (!isPackaged) view.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' });

	return [
		...(isMac ? [{ role: 'appMenu' }] : []),
		{ role: 'fileMenu' },
		{ role: 'editMenu' },
		// Electron's viewMenu role has Reload and the developer tools, so View is built here.
		{ label: 'View', submenu: view },
		{ role: 'windowMenu' }
	];
}
