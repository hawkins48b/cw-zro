/**
 * "Android app", "Desktop app"… for the build this copy runs in (#166): About, Settings footer.
 * platformLabel() says which build it is; this only picks the message.
 */
import { m } from '#lib/paraglide/messages.js';
import { platformLabel } from '#lib/utils/platform.js';

/**
 * @param {string} [platform] - 'web', 'android', 'ios' or 'desktop'; this build's by default.
 * @returns {string} the translated platform name
 */
export function platformText(platform = platformLabel()) {
	switch (platform) {
		case 'android':
			return m.platform_android();
		case 'ios':
			return m.platform_ios();
		case 'desktop':
			return m.platform_desktop();
		default:
			return m.platform_web();
	}
}

/**
 * Short platform name for a tag on the Licences list: Web, Android, iOS, Desktop.
 * @param {string} platform
 */
export function platformShort(platform) {
	switch (platform) {
		case 'android':
			return 'Android';
		case 'ios':
			return 'iOS';
		case 'desktop':
			return m.platform_short_desktop();
		default:
			return m.platform_short_web();
	}
}
