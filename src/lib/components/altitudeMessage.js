import { m } from '#lib/paraglide/messages.js';
import { formatLimit } from '#lib/utils/format.js';
import { minimumFlightAltitude } from '#lib/utils/flightStop.js';

/**
 * The message for a custom altitude too low for the shot (#125): the engine ends every flight below
 * its minimum altitude, given here in the altitude unit chosen ('m', or feet for anything else).
 * @param {string} unit
 * @returns {string}
 */
export function altitudeTooLowMessage(unit) {
	const metric = unit === 'm';
	return m.ballistic_altitude_too_low({
		min: formatLimit(minimumFlightAltitude(metric ? 'm' : 'ft')),
		unit: metric ? m.unit_m() : m.unit_ft()
	});
}
