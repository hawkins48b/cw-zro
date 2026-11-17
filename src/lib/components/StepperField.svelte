<script>
	/**
	 * A typeable number box with − and + buttons (#166), for the Scope View and the shared wind and
	 * atmosphere cards. Layout of the box: [−] [value] [suffix?] [unit chips?] [+].
	 * With a mouse or trackpad as the main pointer (#171) − and + are hidden (StepButton) and the box
	 * gets 6 px side padding, so the value, suffix and chips sit about as far in as in a plain input.
	 *
	 * The buttons change the text the way typing would: they call `onchange` with the new text, which
	 * the page passes to the same store setter as a typed value. The step, the limits and the start
	 * value of an empty box are in `spec` (utils/fieldStep.js, fieldStepSpec).
	 *
	 * @prop {string} [id]            - Id of the input; a generated one otherwise.
	 * @prop {string} [label]         - Visible label. Empty: the caller labels the input (<label for={id}>).
	 * @prop {import('svelte').Snippet} [labelEnd] - Shown at the end of the label row (chips).
	 * @prop {string|number} value    - The box text.
	 * @prop {(text: string) => void} onchange - Typed or stepped text.
	 * @prop {import('#lib/utils/fieldStep.js').StepSpec} spec
	 * @prop {string} decreaseLabel   - Accessible name of −, with step and unit ("Decrease altitude by 10 m").
	 * @prop {string} increaseLabel   - Accessible name of +.
	 * @prop {string} [suffix]        - Unit text after the value ('°', '%', 'm').
	 * @prop {Array<{ value: string, label: string }>} [units] - Unit chips inside the box, before +.
	 * @prop {string} [unit]          - The chosen unit.
	 * @prop {string} [unitsLabel]    - Accessible name of the unit chips.
	 * @prop {(unit: string) => void} [onunitchange]
	 * @prop {string} [message]       - Line under the box ('' for none).
	 * @prop {'hint'|'error'|'warning'} [messageType] - error and warning are announced (role="alert").
	 * @prop {boolean} [invalid]      - aria-invalid; defaults to messageType === 'error' with a message.
	 * @prop {string} [describedby]   - More ids for aria-describedby (a hint printed elsewhere).
	 * @prop {string} [placeholder]
	 * @prop {'right'|'center'} [align] - Text alignment of the value.
	 */
	import { stepValue } from '#lib/utils/fieldStep.js';
	import ChipGroup from '#lib/components/ChipGroup.svelte';
	import StepButton from '#lib/components/StepButton.svelte';

	let {
		id = undefined,
		label = '',
		labelEnd = undefined,
		value,
		onchange,
		spec,
		decreaseLabel,
		increaseLabel,
		suffix = '',
		units = null,
		unit = '',
		unitsLabel = '',
		onunitchange,
		message = '',
		messageType = 'hint',
		invalid = undefined,
		describedby = '',
		placeholder = '0',
		align = 'right'
	} = $props();

	const uid = $props.id();
	let inputId = $derived(id ?? `${uid}-input`);
	let messageId = $derived(`${inputId}-msg`);
	let isInvalid = $derived(invalid ?? (!!message && messageType === 'error'));
	let described = $derived([message ? messageId : '', describedby].filter(Boolean).join(' ') || undefined);

	/** `steps` steps of − (sign −1) or + (1); several while a button is held (#168). */
	function step(sign, steps = 1) {
		let text = value;
		for (let i = 0; i < steps; i++) text = stepValue(text, sign * spec.step, spec);
		onchange?.(text);
	}
</script>

<div class="space-y-0.5 min-w-0">
	{#if label || labelEnd}
		<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-h-6">
			{#if label}
				<label for={inputId} class="text-xs text-surface-600-400">{label}</label>
			{/if}
			{@render labelEnd?.()}
		</div>
	{/if}
	<div class="input !flex !items-center !p-0 pointer-fine:!px-1.5 h-11 overflow-hidden">
		<StepButton dir="down" label={decreaseLabel} onclick={(steps) => step(-1, steps)} />
		<input
			id={inputId}
			class="flex-1 w-8 min-w-0 bg-transparent border-none outline-none shadow-none px-1.5 py-0 font-semibold {align ===
			'center'
				? 'text-center'
				: 'text-right'}"
			type="text"
			inputmode="decimal"
			autocomplete="off"
			{placeholder}
			{value}
			aria-invalid={isInvalid}
			aria-describedby={described}
			oninput={(e) => onchange?.(e.currentTarget.value)}
		/>
		{#if suffix}
			<span class="pr-1.5 text-sm text-surface-600-400 shrink-0">{suffix}</span>
		{/if}
		{#if units}
			<ChipGroup class="pr-1.5" label={unitsLabel} options={units} value={unit} onselect={(u) => onunitchange?.(u)} />
		{/if}
		<StepButton dir="up" label={increaseLabel} onclick={(steps) => step(1, steps)} />
	</div>
	{#if message}
		<p
			id={messageId}
			class="text-xs {messageType === 'error'
				? 'text-error-500'
				: messageType === 'warning'
					? 'text-warning-800-200'
					: 'text-surface-600-400'}"
			role={messageType === 'hint' ? undefined : 'alert'}
		>
			{message}
		</p>
	{/if}
</div>
