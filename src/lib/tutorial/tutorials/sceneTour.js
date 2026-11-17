/**
 * Scene tour (#182): the first tutorial, shipped with the player. It shows the rifle, the optic,
 * the target, the wind in the grass and trees, and a shot. Format: see ../registry.js.
 *
 * @type {import('../registry.js').Tutorial}
 */
export default {
	id: 'scene-tour',
	titleKey: 'tutorial_tour_title',
	descKey: 'tutorial_tour_desc',
	steps: [
		{
			id: 'rifle',
			titleKey: 'tutorial_tour_rifle_title',
			textKey: 'tutorial_tour_rifle_text',
			pose: { anchor: 'rifle', offset: [0.9, 0.45, 0.6] },
			highlight: { model: 'rifle' }
		},
		{
			id: 'optic',
			titleKey: 'tutorial_tour_optic_title',
			textKey: 'tutorial_tour_optic_text',
			pose: { anchor: 'optic', offset: [0.35, 0.15, 0.3] },
			highlight: { model: 'optic' }
		},
		{
			id: 'target',
			titleKey: 'tutorial_tour_target_title',
			textKey: 'tutorial_tour_target_text',
			camera: 'target',
			highlight: { model: 'target', node: 'zone-a' },
			values: ['distance', 'slope']
		},
		{
			id: 'wind',
			titleKey: 'tutorial_tour_wind_title',
			textKey: 'tutorial_tour_wind_text',
			camera: 'shooter',
			values: ['wind']
		},
		{
			id: 'fire',
			titleKey: 'tutorial_tour_fire_title',
			textKey: 'tutorial_tour_fire_text',
			camera: 'side',
			action: 'fire',
			values: ['drop', 'windage', 'time']
		}
	]
};
