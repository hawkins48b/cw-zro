import { app, BrowserWindow, shell } from 'electron';
import serve from 'electron-serve';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { APP_HOST, APP_SCHEME, isAppUrl, isExternalUrl } from './navigation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loadURL = serve({
	directory: join(__dirname, '..', 'build'),
	scheme: APP_SCHEME,
	hostname: APP_HOST
});

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 400,
		minHeight: 600,
		webPreferences: {
			preload: join(__dirname, 'preload.cjs'),
			sandbox: true,
			contextIsolation: true,
			nodeIntegration: false
		}
	});

	loadURL(mainWindow);
}

// No page gets a second window, and the main window never leaves the app. External links
// open in the user's browser, for https: only: openExternal hands any URL to the OS.
app.on('web-contents-created', (_event, contents) => {
	contents.setWindowOpenHandler(({ url }) => {
		if (isExternalUrl(url)) {
			shell.openExternal(url).catch((error) => console.error('openExternal failed:', error));
		}
		return { action: 'deny' };
	});

	contents.on('will-navigate', (event) => {
		if (!isAppUrl(event.url)) event.preventDefault();
	});
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
