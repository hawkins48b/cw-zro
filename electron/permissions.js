// The app needs no browser permission (camera, location, notifications, devices...), so
// every request and check is refused (#104). Kept free of Electron imports for Vitest.

/** @param {import('electron').Session} session */
export function denyAllPermissions(session) {
	session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
	session.setPermissionCheckHandler(() => false);
	session.setDevicePermissionHandler(() => false);
}
