import adapter from '@sveltejs/adapter-static';

const isCapacitor = process.env.BUILD_TARGET === 'capacitor';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		...(isCapacitor && {
			output: {
				bundleStrategy: 'single'
			}
		})
	}
};

export default config;
