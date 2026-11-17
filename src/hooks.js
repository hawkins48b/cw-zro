import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

export const reroute = (request) => {
	return deLocalizeUrl(request.url).pathname;
};
