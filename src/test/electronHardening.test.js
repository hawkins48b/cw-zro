import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { buildMenuTemplate } from '../../electron/menu.js';
import { denyAllPermissions } from '../../electron/permissions.js';

/** All roles in a menu template, submenus included. */
function roles(template) {
	return template.flatMap((item) => [item.role, ...(item.submenu ? roles(item.submenu) : [])]).filter(Boolean);
}

const DEV_ONLY = ['reload', 'forceReload', 'toggleDevTools', 'viewMenu'];

describe('buildMenuTemplate', () => {
	it.each([true, false])('has no reload or developer tools when packaged (isMac %s)', (isMac) => {
		const found = roles(buildMenuTemplate({ isMac, isPackaged: true }));
		for (const role of DEV_ONLY) expect(found).not.toContain(role);
	});

	it('keeps reload and developer tools in unpackaged runs', () => {
		const found = roles(buildMenuTemplate({ isMac: false, isPackaged: false }));
		expect(found).toContain('reload');
		expect(found).toContain('toggleDevTools');
	});

	it.each([true, false])('keeps quit, edit, zoom, full screen and window (isMac %s)', (isMac) => {
		const found = roles(buildMenuTemplate({ isMac, isPackaged: true }));
		for (const role of ['editMenu', 'zoomIn', 'zoomOut', 'resetZoom', 'togglefullscreen', 'windowMenu']) {
			expect(found).toContain(role);
		}
		expect(found).toContain(isMac ? 'appMenu' : 'fileMenu');
	});
});

describe('denyAllPermissions', () => {
	function fakeSession() {
		return {
			setPermissionRequestHandler: vi.fn(),
			setPermissionCheckHandler: vi.fn(),
			setDevicePermissionHandler: vi.fn()
		};
	}

	it.each(['media', 'geolocation', 'notifications', 'clipboard-read', 'fullscreen', 'openExternal', 'unknown'])(
		'refuses a %s request and check',
		(permission) => {
			const session = fakeSession();
			denyAllPermissions(session);
			const callback = vi.fn();
			session.setPermissionRequestHandler.mock.calls[0][0]({}, permission, callback, {});
			expect(callback).toHaveBeenCalledWith(false);
			expect(session.setPermissionCheckHandler.mock.calls[0][0]({}, permission, 'app://-', {})).toBe(false);
		}
	);

	it('refuses device access', () => {
		const session = fakeSession();
		denyAllPermissions(session);
		expect(session.setDevicePermissionHandler.mock.calls[0][0]({ deviceType: 'usb' })).toBe(false);
	});
});

describe('electron-builder.json', () => {
	const config = JSON.parse(readFileSync('electron-builder.json', 'utf8'));

	it('sets the hardening fuses', () => {
		expect(config.electronFuses).toEqual({
			runAsNode: false,
			enableCookieEncryption: true,
			enableNodeOptionsEnvironmentVariable: false,
			enableNodeCliInspectArguments: false,
			enableEmbeddedAsarIntegrityValidation: true,
			onlyLoadAppFromAsar: true,
			grantFileProtocolExtraPrivileges: false,
			resetAdHocDarwinSignature: true
		});
	});

	it('does not turn off the sandbox in the AppImage desktop entry', () => {
		expect(config.linux.executableArgs).toEqual([]);
	});
});

describe('package.json', () => {
	const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

	it('pins js-ballistics to an exact version (#126)', () => {
		expect(pkg.dependencies['js-ballistics']).toBe('3.1.0');
	});

	it('keeps the build-only adapter out of dependencies (#105)', () => {
		expect(pkg.dependencies['@sveltejs/adapter-static']).toBeUndefined();
		expect(pkg.devDependencies['@sveltejs/adapter-static']).toBeDefined();
	});
});
