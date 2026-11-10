// Generated from dsh-connect/client/ by `npm run build:dsh-client` (scripts/build-dsh-client.mjs). Do not edit by hand.
window.__ModuleLoader__.load({
  id: 'dscord',
  factory(require) {
    const module = { exports: {} };
    const exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_dom = require("react-dom");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_jsx_runtime = require("react/jsx-runtime");
// dsh-connect/client/styles.ts
var styles = `
.dscord-connect {
  color-scheme: light;
  --font-family-code: ui-monospace, SFMono-Regular, Consolas, monospace;
  --font-size-2xs: .625rem;
  --font-size-xs: .6875rem;
  --font-size-sm: .75rem;
  --font-size-compact: .8125rem;
  --font-size-body: .875rem;
  --font-size-medium: .9375rem;
  --font-size-base: 1rem;
  --font-size-heading: 1.0625rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.375rem;
  --font-size-title: 1.5rem;
  --font-weight-medium: 550;
  --font-weight-semibold: 650;
  --font-weight-bold: 700;
  --line-height-body: 1.55;
  --line-height-compact: 1.4;
  --opacity-disabled: .45;
  --space-1: 2px;
  --space-2: 4px;
  --space-3: 6px;
  --space-4: 8px;
  --space-5: 10px;
  --space-6: 12px;
  --space-7: 14px;
  --space-8: 16px;
  --space-9: 18px;
  --space-10: 20px;
  --space-11: 22px;
  --space-12: 24px;
  --space-14: 28px;
  --space-16: 32px;
  --radius-xs: 3px;
  --radius-sm: 4px;
  --radius-control: 5px;
  --radius-md: 6px;
  --radius-server: 16px;
  --radius-pill: 999px;
  --radius-round: 50%;
  --size-avatar-message: 40px;
  --focus-width: 2px;
  --motion-fast: 150ms;
  --color-text-on-accent: #ffffff;
  --font-family-ui: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
  --radius-lg: var(--dsw-radius-md, 8px);
  --radius-xl: var(--dsw-radius-lg, 12px);
  --color-bg-primary: var(--dsw-alias-bg-layer-1, #ffffff);
  --color-bg-secondary: var(--dsw-alias-settings-card-fill, #f2f3f5);
  --color-bg-input: var(--dsw-alias-bg-layer-1, #ebedef);
  --color-bg-hover: var(--dsw-alias-interactive-bg-hover, #e7e9ec);
  --color-text-primary: var(--dsw-alias-label-primary, #060607);
  --color-text-muted: var(--dsw-alias-label-secondary, #5c6069);
  --color-border-subtle: var(--dsw-alias-settings-card-stroke, #e0e2e6);
  --color-border-normal: var(--dsw-alias-settings-card-stroke, #cdd1d7);
  --color-accent: var(--dsw-alias-state-business-primary, #5865f2);
  --color-focus: var(--dsw-alias-state-business-primary, #0068a8);
  --color-link: var(--dsw-alias-link, #0068a8);
  --color-status-success: var(--dsw-alias-state-success-primary, #008642);
  --color-status-warning: var(--dsw-alias-state-warn-primary, #997000);
  --color-status-danger: var(--dsw-alias-state-error-primary, #d72f36);
  --color-text-danger: var(--dsw-alias-state-error-primary, #c92d35);
}
body[data-ds-dark-theme] .dscord-connect {
  color-scheme: dark;
  --color-bg-primary: var(--dsw-alias-bg-layer-1, #313338);
  --color-bg-secondary: var(--dsw-alias-settings-card-fill, #2b2d31);
  --color-bg-input: var(--dsw-alias-bg-layer-1, #383a40);
  --color-bg-hover: var(--dsw-alias-interactive-bg-hover, #35373c);
  --color-text-primary: var(--dsw-alias-label-primary, #f2f3f5);
  --color-text-muted: var(--dsw-alias-label-secondary, #949ba4);
  --color-border-subtle: var(--dsw-alias-settings-card-stroke, #3f4147);
  --color-border-normal: var(--dsw-alias-settings-card-stroke, #45474e);
  --color-accent: var(--dsw-alias-state-business-primary, #5865f2);
  --color-focus: var(--dsw-alias-state-business-primary, #00a8fc);
  --color-link: var(--dsw-alias-link, #00a8fc);
  --color-status-success: var(--dsw-alias-state-success-primary, #23a559);
  --color-status-warning: var(--dsw-alias-state-warn-primary, #f0b232);
  --color-status-danger: var(--dsw-alias-state-error-primary, #f23f43);
  --color-text-danger: var(--dsw-alias-state-error-primary, #fa777c);
}
@media (prefers-reduced-motion: reduce) {
  .dscord-connect { --motion-fast: 0ms; }
}

.dscord-connect { box-sizing: border-box; width: 100%; height: 100%; min-height: 0; overflow: auto; background: var(--color-bg-primary); color: var(--color-text-primary); font: var(--font-size-body)/var(--line-height-body) var(--font-family-ui); }
.dscord-connect *, .dscord-connect *::before, .dscord-connect *::after { box-sizing: border-box; }
.dscord-connect :is(h1, h2, h3, p, ul, ol, fieldset, legend) { margin: 0; padding: 0; }
.dscord-connect :is(ul, ol) { list-style: none; }
.dscord-connect fieldset { border: 0; min-width: 0; }
.dscord-connect .dc-content { display: grid; gap: var(--space-8); width: min(100%, 780px); margin: 0 auto; padding: var(--space-14) var(--space-12) var(--space-16); }
.dscord-connect .dc-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4) var(--space-8); }
.dscord-connect h1 { font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); line-height: var(--line-height-compact); }
.dscord-connect h2 { font-size: var(--font-size-heading); font-weight: var(--font-weight-semibold); line-height: var(--line-height-compact); }
.dscord-connect h3 { font-size: var(--font-size-body); font-weight: var(--font-weight-semibold); line-height: var(--line-height-compact); }
.dscord-connect .dc-toolbar, .dscord-connect .dc-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); }
.dscord-connect .dc-account { min-width: 0; text-align: right; line-height: var(--line-height-compact); }
.dscord-connect .dc-account-name { font-weight: var(--font-weight-medium); overflow-wrap: anywhere; }
.dscord-connect .dc-muted { color: var(--color-text-muted); }
.dscord-connect .dc-small, .dscord-connect .dc-meta { font-size: var(--font-size-compact); }
.dscord-connect .dc-meta { color: var(--color-text-muted); overflow-wrap: anywhere; }
.dscord-connect .dc-error { color: var(--color-text-danger); overflow-wrap: anywhere; }
.dscord-connect a { color: var(--color-link); text-decoration: none; white-space: nowrap; }
.dscord-connect a:hover { text-decoration: underline; }
.dscord-connect :is(select, textarea, summary, a, input[type="radio"], input[type="checkbox"]):focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--space-1); }

.dscord-connect .dc-notices { position: sticky; top: var(--space-4); z-index: 1; display: grid; gap: var(--space-4); }
.dscord-connect .dc-notice { padding: var(--space-5) var(--space-7); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: var(--color-bg-secondary); overflow-wrap: anywhere; }
.dscord-connect .dc-notice[data-tone="success"] { border-color: color-mix(in srgb, var(--color-status-success) 45%, transparent); background: color-mix(in srgb, var(--color-status-success) 10%, var(--color-bg-primary)); }
.dscord-connect .dc-notice[data-tone="error"] { border-color: color-mix(in srgb, var(--color-status-danger) 45%, transparent); background: color-mix(in srgb, var(--color-status-danger) 8%, var(--color-bg-primary)); color: var(--color-text-danger); }

.dscord-connect .dc-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.dscord-connect .dc-step { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-5) var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xl); color: var(--color-text-muted); line-height: var(--line-height-compact); }
.dscord-connect .dc-step-mark { display: grid; place-items: center; flex: 0 0 auto; width: var(--space-11); height: var(--space-11); border: 1px solid currentColor; border-radius: var(--radius-round); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); }
.dscord-connect .dc-step-copy { display: grid; gap: var(--space-1); min-width: 0; }
.dscord-connect .dc-step strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-step small { font-size: var(--font-size-sm); }
.dscord-connect .dc-step[data-state="current"] { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 6%, transparent); color: var(--color-text-primary); }
.dscord-connect .dc-step[data-state="current"] .dc-step-mark { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-connect .dc-step[data-state="done"] .dc-step-mark { border-color: var(--color-status-success); color: var(--color-status-success); }

.dscord-connect .dc-panel { display: grid; gap: var(--space-8); padding: var(--space-10) var(--space-12); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xl); background: var(--color-bg-secondary); }
.dscord-connect .dc-heading { display: grid; gap: var(--space-2); }
.dscord-connect .dc-how { display: grid; gap: var(--space-3); counter-reset: dc-how; color: var(--color-text-muted); }
.dscord-connect .dc-how li { display: flex; gap: var(--space-4); counter-increment: dc-how; }
.dscord-connect .dc-how li::before { content: counter(dc-how) "."; flex: 0 0 auto; font-variant-numeric: tabular-nums; }

.dscord-connect .dc-form { display: grid; gap: var(--space-6); }
.dscord-connect .dc-field { display: grid; gap: var(--space-3); min-width: 0; font-size: var(--font-size-compact); font-weight: var(--font-weight-medium); }
.dscord-connect .dc-hint { color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: 400; }
.dscord-connect .dc-inline { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-4); }
.dscord-connect .dc-inline .dc-field { flex: 1 1 180px; }
.dscord-connect :is(select, textarea) { width: 100%; border: 1px solid var(--color-border-normal); border-radius: var(--radius-lg); background: var(--color-bg-input); color: var(--color-text-primary); font: inherit; font-size: var(--font-size-body); font-weight: 400; }
.dscord-connect select { min-height: var(--space-16); padding: var(--space-2) var(--space-5); text-overflow: ellipsis; }
.dscord-connect textarea.dc-key { min-height: 88px; resize: vertical; padding: var(--space-4) var(--space-6); font-family: var(--font-family-code); font-size: var(--font-size-compact); word-break: break-all; }
.dscord-connect :is(select, textarea):disabled { opacity: var(--opacity-disabled); }
.dscord-connect :is(input, textarea)::placeholder { color: var(--color-text-muted); opacity: 1; }
.dscord-connect .dc-actions select { width: auto; max-width: 240px; }
.dscord-connect .dc-check { display: flex; align-items: center; gap: var(--space-4); }
.dscord-connect input:is([type="radio"], [type="checkbox"]) { flex: 0 0 auto; accent-color: var(--color-accent); }

.dscord-connect .dc-options { display: grid; gap: var(--space-1); }
.dscord-connect .dc-options legend { margin-bottom: var(--space-3); font-size: var(--font-size-compact); font-weight: var(--font-weight-medium); }
.dscord-connect .dc-option { display: flex; align-items: flex-start; gap: var(--space-5); padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); cursor: pointer; line-height: var(--line-height-compact); }
.dscord-connect .dc-option:hover { background: var(--color-bg-hover); }
.dscord-connect .dc-option:has(input:checked) { background: color-mix(in srgb, var(--color-accent) 9%, transparent); }
.dscord-connect .dc-option input { margin: var(--space-1) 0 0; }
.dscord-connect .dc-option strong, .dscord-connect .dc-option small { display: block; }
.dscord-connect .dc-option strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-option small { margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-sm); }

.dscord-connect .dc-list { display: grid; }
.dscord-connect .dc-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4) var(--space-8); padding: var(--space-6) 0; border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-row:first-child { border-top: 0; padding-top: 0; }
.dscord-connect .dc-row:last-child { padding-bottom: 0; }
.dscord-connect .dc-copy { display: grid; gap: var(--space-1); flex: 1 1 220px; min-width: 0; }
.dscord-connect .dc-title { font-weight: var(--font-weight-semibold); overflow-wrap: anywhere; }
.dscord-connect .dc-group { display: grid; gap: var(--space-5); }
.dscord-connect .dc-group > h3 { color: var(--color-text-muted); font-size: var(--font-size-compact); font-weight: var(--font-weight-medium); }

.dscord-connect .dc-bots { display: grid; gap: var(--space-6); }
.dscord-connect .dc-bot { display: grid; gap: var(--space-6); padding: var(--space-8); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xl); background: var(--color-bg-primary); }
.dscord-connect .dc-identity { display: flex; align-items: center; gap: var(--space-6); min-width: 0; flex: 1 1 220px; }
.dscord-connect .dc-avatar { display: grid; place-items: center; flex: 0 0 auto; width: var(--size-avatar-message); height: var(--size-avatar-message); border-radius: var(--radius-xl); background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); }
.dscord-connect .dc-links { display: grid; padding-top: var(--space-6); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-status { display: inline-flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); font-size: var(--font-size-compact); white-space: nowrap; }
.dscord-connect .dc-status::before { content: ""; flex: 0 0 auto; width: var(--space-4); height: var(--space-4); border-radius: var(--radius-round); background: currentColor; }
.dscord-connect .dc-status[data-status="online"] { color: var(--color-status-success); }
.dscord-connect .dc-status[data-status="error"] { color: var(--color-status-danger); }
.dscord-connect .dc-status[data-status="connecting"] { color: var(--color-accent); }
.dscord-connect .dc-settings { display: grid; gap: var(--space-8); padding-top: var(--space-6); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-section { display: grid; gap: var(--space-4); }

.dscord-connect .dc-disclosure > summary { display: flex; align-items: center; gap: var(--space-4); width: fit-content; cursor: pointer; font-weight: var(--font-weight-medium); list-style: none; }
.dscord-connect .dc-disclosure > summary::-webkit-details-marker { display: none; }
.dscord-connect .dc-disclosure > summary::before { content: ""; flex: 0 0 auto; width: var(--space-3); height: var(--space-3); border-right: var(--focus-width) solid currentColor; border-bottom: var(--focus-width) solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-fast); }
.dscord-connect .dc-disclosure[open] > summary::before { transform: rotate(45deg); }
.dscord-connect .dc-disclosure[open] > summary { margin-bottom: var(--space-6); }
.dscord-connect .dc-disclosure > .dc-body { display: grid; gap: var(--space-6); }
.dscord-connect .dc-divided { padding-top: var(--space-8); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect code { display: block; font-family: var(--font-family-code); font-size: var(--font-size-compact); overflow-wrap: anywhere; user-select: text; }

.dscord-connect .dc-memory-filter { display: flex; flex-wrap: wrap; gap: var(--space-4); }
.dscord-connect .dc-memory-filter select { width: auto; flex: 0 1 140px; }
.dscord-connect .dc-memory-filter input { min-width: 0; flex: 1 1 150px; }
.dscord-connect .dc-memory-list { display: flex; flex-wrap: wrap; gap: var(--space-4); }
.dscord-connect .dc-memory-item { display: grid; gap: var(--space-3); padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); overflow-wrap: anywhere; }
.dscord-connect .dc-memory-item p { white-space: pre-wrap; }
.dscord-connect .dc-memory-item details { color: var(--color-text-muted); font-size: var(--font-size-sm); }
.dscord-connect .dc-memory-item li { margin-block: var(--space-4); overflow-wrap: anywhere; }
.dscord-connect .dc-memory-label { display: inline-block; margin-right: var(--space-3); padding: 0 var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm); color: var(--color-text-muted); font-size: var(--font-size-sm); }

@media (max-width: 640px) {
  .dscord-connect .dc-content { padding: var(--space-9) var(--space-7) var(--space-12); }
  .dscord-connect .dc-panel { padding: var(--space-8); }
  .dscord-connect .dc-bot { padding: var(--space-6); }
  .dscord-connect .dc-steps { grid-template-columns: minmax(0, 1fr); }
  .dscord-connect .dc-account { text-align: left; }
}
`;
// dsh-connect/client/components/forms.tsx
var field = (form, name) => form.elements.namedItem(name);
/** Whether pasted text is a whole connection key: base64url JSON naming a chat server and a one-time code. */
function isConnectionKey(text) {
	if (!/^[A-Za-z0-9_-]{16,}$/.test(text)) return false;
	try {
		const value = JSON.parse(atob(text.replace(/-/g, "+").replace(/_/g, "/")));
		return typeof value.server === "string" && typeof value.code === "string";
	} catch {
		return false;
	}
}
/**
* Signs in with a connection key from the DSCord web page. Pasting a whole key signs in at once, and the key
* never stays in the form.
*/
function LoginForm({ connection, state, t }) {
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
		className: "dc-panel dc-login",
		"aria-label": t("loginTitle"),
		onSubmit: (event) => {
			event.preventDefault();
			const input = field(event.currentTarget, "connectionKey");
			const key = input.value.trim();
			input.value = "";
			if (key) connection.login(key);
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("loginTitle") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ol", {
				className: "dc-how",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("loginStep1") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("loginStep2") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("loginStep3") })
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("connectionKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						name: "connectionKey",
						className: "dc-key",
						required: true,
						rows: 3,
						placeholder: t("keyPlaceholder"),
						autoComplete: "off",
						autoCapitalize: "none",
						spellCheck: false,
						disabled: busy,
						onPaste: (event) => {
							const key = event.clipboardData.getData("text").trim();
							if (!isConnectionKey(key)) return;
							event.preventDefault();
							event.currentTarget.value = "";
							connection.login(key);
						}
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-hint",
					children: t("keyHint")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dc-actions",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					type: "submit",
					disabled: busy,
					children: t(state.busy?.action === "login" ? "loggingIn" : "login")
				})
			})
		]
	});
}
/** Picks the model a Bot runs on from the models DSH has configured. */
function ModelForm({ bot, connection, state, value, t }) {
	const catalog = value.models;
	const models = (catalog?.providers || []).flatMap((provider) => provider.models);
	const saved = bot.modelSelection || catalog?.defaultSelection;
	const [reference, setReference] = (0, react.useState)(saved?.model || "");
	const selected = models.find((model) => model.model === reference);
	const pending = !value.nativeMode && bot.activeModel && bot.modelSelection && bot.activeModel.model !== bot.modelSelection.model;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dc-section",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dc-inline",
			onSubmit: (event) => {
				event.preventDefault();
				connection.saveModel(bot.id, { model: reference });
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dc-field",
				children: [t("model"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					name: "model",
					"aria-label": t("model"),
					required: true,
					value: reference,
					disabled: Boolean(state.busy),
					onChange: (event) => setReference(event.target.value),
					children: [
						!reference && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("noModel")
						}),
						reference && !selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: reference,
							disabled: true,
							children: `${reference} · ${t("modelUnavailable")}`
						}),
						(catalog?.providers || []).filter((provider) => provider.models.length).map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
							label: provider.name,
							children: provider.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: model.model,
								children: model.name
							}, model.model))
						}, provider.id))
					]
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				type: "submit",
				disabled: Boolean(state.busy) || !selected || reference === bot.modelSelection?.model,
				children: t("saveModel")
			})]
		}), pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "dc-meta",
			role: "status",
			children: t("modelPending")
		})]
	});
}
/**
* Creates a Bot on this device and, once the account has a chat server, brings it online there in the same step.
* A creation whose answer was lost keeps its request id in session storage, so trying again confirms the same
* creation instead of making a second Bot.
*/
function CreateLocalBot({ connection, state, value, t, startOpen }) {
	const catalog = value.models;
	const models = (catalog?.providers || []).flatMap((provider) => provider.models);
	const servers = value.user ? value.servers || [] : [];
	const storageKey = `dscord.pending-native.${value.hostId || "local"}.${value.user?.id || "local-owner"}`;
	const [draft] = (0, react.useState)(() => {
		try {
			const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
			return stored && typeof stored.requestId === "string" && [
				"name",
				"role",
				"model"
			].every((key) => typeof stored.input?.[key] === "string") ? stored : null;
		} catch {
			return null;
		}
	});
	const pending = (0, react.useRef)(draft);
	const [open, setOpen] = (0, react.useState)(startOpen || Boolean(draft));
	const [name, setName] = (0, react.useState)(draft?.input.name || "");
	const [role, setRole] = (0, react.useState)(draft?.input.role || "");
	const [model, setModel] = (0, react.useState)(draft?.input.model || catalog?.defaultSelection?.model || "");
	const [serverUrl, setServerUrl] = (0, react.useState)("");
	const [uncertain, setUncertain] = (0, react.useState)(Boolean(draft));
	const disabled = Boolean(state.busy);
	const usable = models.some((item) => item.model === model && !item.needsKey);
	const target = servers.find((server) => server.url === serverUrl) || servers[0];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "dc-disclosure dc-divided",
		open,
		onToggle: (event) => setOpen(event.currentTarget.open),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("newBot") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dc-form",
			onSubmit: async (event) => {
				event.preventDefault();
				const input = {
					name: name.trim(),
					role: role.trim(),
					model
				};
				if (!input.name || !usable) return;
				const fingerprint = JSON.stringify(input);
				if (pending.current?.fingerprint !== fingerprint) pending.current = {
					input,
					fingerprint,
					requestId: globalThis.crypto?.randomUUID?.() || `create-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
				};
				try {
					sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
				} catch {}
				if (await connection.createNative({
					...input,
					requestId: pending.current.requestId
				}, target?.url)) {
					pending.current = null;
					setUncertain(false);
					setName("");
					setRole("");
					setOpen(false);
					try {
						sessionStorage.removeItem(storageKey);
					} catch {}
				} else setUncertain(true);
			},
			children: [
				!models.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-notice",
					children: t("modelsMissing")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("botName"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						name: "botName",
						required: true,
						maxLength: 80,
						placeholder: t("botNamePlaceholder"),
						value: name,
						onChange: (event) => {
							setName(event.target.value);
							setUncertain(false);
						},
						disabled,
						autoComplete: "off"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("botRole"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						name: "botRole",
						maxLength: 1e3,
						placeholder: t("botRolePlaceholder"),
						value: role,
						onChange: (event) => {
							setRole(event.target.value);
							setUncertain(false);
						},
						disabled,
						autoComplete: "off"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-inline",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-field",
						children: [t("model"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							name: "localModel",
							required: true,
							value: model,
							onChange: (event) => {
								setModel(event.target.value);
								setUncertain(false);
							},
							disabled: disabled || !models.length,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("noModel")
							}), models.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: item.model,
								disabled: item.needsKey === true,
								children: item.name || item.model
							}, item.model))]
						})]
					}), servers.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-field",
						children: [t("joinServer"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							name: "joinServer",
							value: target?.url || "",
							onChange: (event) => setServerUrl(event.target.value),
							disabled,
							children: servers.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: server.url,
								children: server.serverName
							}, server.url))
						})]
					})]
				}),
				uncertain && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-meta",
					children: t("creationPending")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-actions",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "submit",
						variant: "primary",
						disabled: disabled || !usable,
						children: t(state.busy?.action === "create-native" ? "creatingLocal" : state.busy?.action === "attach" ? "joining" : uncertain ? "confirmCreation" : target ? "createAndJoin" : "createLocal")
					}), !target && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dc-meta",
						children: t("signInToAttach")
					})]
				})
			]
		})]
	});
}
// dsh-connect/client/components/kernel.tsx
var message = (reason) => reason.message;
var MEMORY_SECTIONS = [
	"currentClaims",
	"preferences",
	"projectFacts",
	"changes"
];
var ACTIVITIES = [
	"listening",
	"waiting",
	"working",
	"speaking"
];
var MODES = [
	"mention",
	"shadow",
	"natural"
];
function FeedbackLine({ feedback, ok }) {
	if (!feedback) return null;
	const error = "error" in feedback ? feedback.error : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		role: error ? "alert" : "status",
		className: error ? "dc-error dc-small" : "dc-meta",
		children: error || ok
	});
}
/** The private key for the natural-participation decision service; a saved key is never shown again. */
function DecisionProviderForm({ connection, t }) {
	const [provider, setProvider] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	const [feedback, setFeedback] = (0, react.useState)(null);
	const [enabled, setEnabled] = (0, react.useState)(true);
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		connection.kernel("kernel-state", {}, controller).then((kernel) => {
			if (controller.signal.aborted) return;
			setProvider(kernel.decisionProvider || null);
			setEnabled(kernel.decisionProvider?.enabled !== false);
		}).catch((reason) => {
			if (!controller.signal.aborted) setFeedback({ error: message(reason) });
		});
		return () => controller.abort();
	}, [connection]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "dc-disclosure",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("decisionTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-body",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-meta",
					children: t("decisionHelp")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-meta",
					children: provider ? `${t(provider.configured ? "configured" : "notConfigured")} · ${t(provider.available === true ? "available" : provider.available === false ? "serviceUnavailable" : "availabilityUnknown")}${provider.model ? ` · ${provider.model}` : ""}` : t("unknown")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
					className: "dc-form",
					onSubmit: async (event) => {
						event.preventDefault();
						const input = event.currentTarget.elements.namedItem("decisionApiKey");
						const apiKey = input.value.trim();
						input.value = "";
						setBusy(true);
						setFeedback(null);
						try {
							setProvider(await connection.kernel("save-decision-provider", {
								enabled,
								...apiKey ? { apiKey } : {}
							}));
							setFeedback({ ok: true });
						} catch (reason) {
							setFeedback({ error: message(reason) });
						} finally {
							setBusy(false);
						}
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dc-field",
								children: [t("decisionApiKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									name: "decisionApiKey",
									type: "password",
									autoComplete: "new-password",
									disabled: busy,
									spellCheck: false,
									autoCapitalize: "none"
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dc-hint",
								children: t("decisionKeyHelp")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dc-check",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								name: "enabled",
								type: "checkbox",
								checked: enabled,
								onChange: (event) => setEnabled(event.target.checked),
								disabled: busy
							}), t("enableDecision")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dc-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								type: "submit",
								variant: "outline",
								disabled: busy,
								children: t("saveDecision")
							})
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeedbackLine, {
					feedback,
					ok: t("decisionSaved")
				})
			]
		})]
	});
}
function SourceList({ sources, t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", { children: sources.map((source) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: source.authorId || source.authorKind || t("unknown") }),
		source.roomId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: source.roomId }),
		source.timestamp != null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: new Date(source.timestamp).toLocaleString() }),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: source.eventId || source.id })
	] }, `${source.id}/${source.revision || ""}`)) });
}
/** What one Bot remembers about people and projects, with where each claim came from. */
function LocalSourceMemory({ connection, nativeBotId, t }) {
	const [kind, setKind] = (0, react.useState)("person");
	const [query, setQuery] = (0, react.useState)("");
	const [request, setRequest] = (0, react.useState)({ kind: "person" });
	const [result, setResult] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)(null);
	const [loading, setLoading] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setResult(null);
		connection.kernel("memory-profile", {
			nativeBotId,
			...request
		}, controller).then((value) => {
			if (!controller.signal.aborted) setResult(value);
		}).catch((reason) => {
			if (!controller.signal.aborted) setError(message(reason));
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [
		connection,
		nativeBotId,
		request
	]);
	const view = result?.view;
	const filled = MEMORY_SECTIONS.filter((key) => view?.[key]?.length);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-section",
		"aria-label": t("memory"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("memory") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: "dc-memory-filter",
				onSubmit: (event) => {
					event.preventDefault();
					setRequest({
						kind,
						...query.trim() ? { query: query.trim() } : {}
					});
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						"aria-label": t("memory"),
						value: kind,
						onChange: (event) => {
							setKind(event.target.value);
							setRequest({ kind: event.target.value });
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "person",
							children: t("people")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "project",
							children: t("projects")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						"aria-label": t("memorySearch"),
						placeholder: t("memorySearch"),
						value: query,
						onChange: (event) => setQuery(event.target.value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "submit",
						variant: "outline",
						disabled: loading,
						children: t("search")
					})
				]
			}),
			loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "dc-muted",
				children: t("loadingKernel")
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error",
				children: error
			}),
			result?.items && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-memory-list",
				children: [!result.items.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted",
					children: t("noMemory")
				}), result.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: () => setRequest({
						kind,
						id: item.id
					}),
					children: item.name || item.id
				}, item.id))]
			}),
			view && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: result.identity?.name || result.id }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-meta",
						children: result.id
					}),
					filled.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "dc-section",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t(key) }), view[key]?.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
							className: "dc-memory-item",
							children: [
								item.claimState && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dc-memory-label",
									children: t(item.claimState)
								}),
								item.kind && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dc-memory-label",
									children: t(item.kind)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: item.text }),
								item.saidBy && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: item.saidBy
								}),
								item.scope && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: item.scope
								}),
								item.conflicts?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: t("conflicts")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("sources") }),
									item.sources?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceList, {
										sources: item.sources,
										t
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("noSources") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: item.id })
								] })
							]
						}, `${item.id}/${item.revision || ""}`))]
					}, key)),
					!filled.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-muted",
						children: t("noMemory")
					}),
					view.historyGaps?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-meta",
						children: t("limitedMemory")
					}) : null,
					Object.values(view.budget?.omitted || {}).some((count) => count > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-meta",
						children: t("shortenedMemory")
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-hint",
				children: t("memoryHelp")
			})
		]
	});
}
/** One local Bot's settings: its model (passed in by the row), how it takes part in conversations, and its memory. */
function LocalBotSettings({ bot, connection, t, children }) {
	const [kernel, setKernel] = (0, react.useState)(null);
	const [mode, setMode] = (0, react.useState)("");
	const [loading, setLoading] = (0, react.useState)(true);
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	const [feedback, setFeedback] = (0, react.useState)(null);
	const [revision, setRevision] = (0, react.useState)(0);
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		setKernel(null);
		connection.kernel("kernel-state", { nativeBotId: bot.id }, controller).then((value) => {
			if (controller.signal.aborted) return;
			setKernel(value);
			setMode(value.desiredAttention?.mode || value.attention?.mode || "");
		}).catch((reason) => {
			if (!controller.signal.aborted) setError(message(reason));
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [
		connection,
		bot.id,
		revision
	]);
	const activity = kernel?.attention?.activity || kernel?.attention?.status;
	const current = kernel?.desiredAttention?.mode || kernel?.attention?.mode;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-settings",
		"aria-label": t("botSettings", { name: bot.name }),
		children: [
			children,
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("participation") }),
					loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: "dc-muted",
						children: t("loadingKernel")
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "dc-error",
						children: error
					}),
					kernel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-meta",
						children: `${t("activity")} · ${t(activity && ACTIVITIES.includes(activity) ? activity : "unknown")}`
					}),
					kernel?.desiredAttention?.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						className: "dc-meta",
						children: t("participationPending")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						className: "dc-form",
						onSubmit: async (event) => {
							event.preventDefault();
							setBusy(true);
							setFeedback(null);
							try {
								const receipt = await connection.kernel("attention-update", {
									nativeBotId: bot.id,
									mode
								});
								setFeedback({
									ok: true,
									pending: receipt.status === "pending"
								});
								setRevision((value) => value + 1);
							} catch (reason) {
								setFeedback({ error: message(reason) });
							} finally {
								setBusy(false);
							}
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("fieldset", {
							className: "dc-options",
							"aria-label": t("participation"),
							disabled: busy || loading || !kernel,
							children: MODES.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dc-option",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "radio",
									name: "participationMode",
									value,
									checked: mode === value,
									onChange: () => setMode(value)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(value) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(`${value}Help`) })] })]
							}, value))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dc-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								type: "submit",
								variant: "outline",
								disabled: busy || loading || !kernel || !mode || mode === current,
								children: t("saveParticipation")
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeedbackLine, {
						feedback,
						ok: t(feedback && "pending" in feedback && feedback.pending ? "participationPending" : "participationSaved")
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalSourceMemory, {
				connection,
				nativeBotId: bot.id,
				t
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-meta",
				children: `${t("stableIdentity")} · ${bot.id}`
			})
		]
	});
}
var POLICIES = [
	["auto", "policyAuto"],
	["notify", "policyNotify"],
	["manual", "policyManual"]
];
/** The plugin's own version, which server protocol it speaks, and how it upgrades. */
function KernelUpdatePanel({ connection, initial, t }) {
	const [view, setView] = (0, react.useState)(initial);
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	(0, react.useEffect)(() => setView(initial), [initial]);
	async function run(action, payload = {}) {
		setBusy(true);
		setError(null);
		try {
			setView(await connection.kernel(action, payload));
		} catch (reason) {
			setError(message(reason));
		} finally {
			setBusy(false);
		}
	}
	const installing = view.phase === "installing";
	(0, react.useEffect)(() => {
		if (!installing) return void 0;
		const timer = setInterval(() => void connection.kernel("kernel-update-status").then(setView).catch(() => {}), 1e3);
		return () => clearInterval(timer);
	}, [connection, installing]);
	const summary = view.phase === "failed" ? t("updateFailed", { error: view.error || "" }) : view.phase === "installed" ? t("updateInstalled") : view.phase === "restart-required" ? t("updateRestart") : !view.serverProtocol ? t("updateUnchecked") : !view.compatible && !view.available ? t("updateIncompatible") : view.available ? t("updateAvailable", { version: view.available }) : t("updateLatest");
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("updateTitle"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-copy",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("updateTitle") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: t("updateCurrent", { version: view.current }) + (view.serverProtocol ? ` · ${t("updateProtocol", { protocol: view.serverProtocol })}` : "")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "status",
							className: view.phase === "failed" || view.compatible === false ? "dc-error dc-small" : "dc-meta",
							children: summary
						}),
						view.source && view.source !== "registry" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: t("updateNotRegistry")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-actions",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						type: "button",
						disabled: busy || installing,
						onClick: () => void run("kernel-update-check"),
						children: t("updateCheck")
					}), view.available && view.source === "registry" && view.phase !== "installed" && view.phase !== "restart-required" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						type: "button",
						disabled: busy || installing,
						onClick: () => void run("kernel-update-install"),
						children: installing ? t("updateInstalling") : t("updateInstall", { version: view.available })
					})]
				})]
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error dc-small",
				children: error
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dc-disclosure dc-divided",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: `${t("updatePolicy")} · ${t(POLICIES.find(([policy]) => policy === view.policy)?.[1] || "policyNotify")}` }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
					className: "dc-options",
					"aria-label": t("updatePolicy"),
					disabled: busy || installing,
					children: [POLICIES.map(([policy, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "kernelUpdatePolicy",
							value: policy,
							checked: view.policy === policy,
							onChange: () => void run("kernel-update-policy", { policy })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(key) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(`${key}Help`) })] })]
					}, policy)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: view.channel === "prerelease",
							onChange: (event) => void run("kernel-update-policy", { channel: event.target.checked ? "prerelease" : "stable" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("updatePrerelease") }) })]
					})]
				})]
			})
		]
	});
}
/** Where on this device the plugin keeps the account's connection and each Bot's files. */
function ConfigDirectory({ directory, t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "dc-disclosure",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("configDirectory") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: directory })]
	});
}
// dsh-connect/client/components/servers.tsx
/** The chat server's web address, when it is one a browser can open safely. */
function webUrl(serverUrl) {
	try {
		const url = new URL(serverUrl);
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}
function origin(url) {
	try {
		return new URL(url).origin;
	} catch {
		return url;
	}
}
/** Searches central's server index and adds a listed server in one step. */
function ServerSearch({ connection, state, value, t }) {
	const [results, setResults] = (0, react.useState)(null);
	const [searching, setSearching] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	const added = new Set((value.servers || []).map((server) => origin(server.url)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dc-section",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: "dc-inline",
				role: "search",
				"aria-label": t("searchServers"),
				onSubmit: (event) => {
					event.preventDefault();
					const query = event.currentTarget.elements.namedItem("query").value;
					setSearching(true);
					setError("");
					connection.searchServers(query).then((found) => setResults(found.servers), (reason) => {
						setResults(null);
						setError(reason.message);
					}).finally(() => setSearching(false));
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("searchServers"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						name: "query",
						type: "search",
						maxLength: 200,
						autoComplete: "off"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					type: "submit",
					variant: "outline",
					disabled: searching,
					children: t(searching ? "searchingServers" : "searchQuery")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: error ? "dc-error dc-small" : "dc-hint",
				children: error || (results && !results.length ? t("noServerResults") : t("searchServersHelp"))
			}),
			results && results.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-list",
				"aria-label": t("searchServers"),
				children: results.map((server) => {
					const isAdded = server.added || added.has(server.origin);
					const inviteOnly = server.join === "invite" && !isAdded;
					const tags = server.tags?.length ? ` · ${server.tags.map((tag) => `#${tag}`).join(" ")}` : "";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "dc-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-copy",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-title",
									children: server.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: `${t("serverNumber", { number: server.number })} · ${server.origin}`
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: t("serverMembers", {
										people: server.members?.people ?? 0,
										bots: server.members?.bots ?? 0
									}) + tags
								}),
								server.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: server.description
								}),
								inviteOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: t("inviteOnlyHint")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							type: "button",
							disabled: isAdded || inviteOnly || Boolean(state.busy),
							"aria-label": t("addServerLabel", { server: server.name }),
							onClick: () => void connection.addServer(server.origin),
							children: t(isAdded ? "serverAdded" : inviteOnly ? "inviteOnly" : "addThisServer")
						})]
					}, server.origin);
				})
			})
		]
	});
}
/** The chat servers this account has added; adding another, by search or by address, opens on request. */
function ServersPanel(props) {
	const { connection, state, value, t } = props;
	const busy = Boolean(state.busy);
	const servers = value.servers || [];
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("servers"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-heading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("servers") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted",
					children: t("serversHelp")
				})]
			}),
			servers.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-list",
				children: servers.map((server) => {
					const href = webUrl(server.url);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "dc-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-title",
								children: server.serverName
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-meta",
								children: server.url
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-actions",
							children: [href && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href,
								target: "_blank",
								rel: "noopener noreferrer",
								children: t("openWeb")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								type: "button",
								disabled: busy,
								onClick: () => void connection.removeServer(server.url),
								"aria-label": t("removeServerLabel", { server: server.serverName }),
								children: t("removeServer")
							})]
						})]
					}, server.url);
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("noServers")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dc-disclosure dc-divided",
				open: !servers.length,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("addServer") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerSearch, { ...props }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: t("addByAddress")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddServerForm, {
							connection,
							state,
							t
						})
					]
				})]
			})
		]
	});
}
function AddServerForm({ connection, state, t }) {
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
		className: "dc-inline",
		"aria-label": t("addServer"),
		onSubmit: (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			const input = form.elements.namedItem("serverUrl");
			const invite = form.elements.namedItem("inviteCode");
			const url = input.value.trim();
			if (!url) return;
			const code = invite.value.trim();
			input.value = "";
			invite.value = "";
			connection.addServer(url, code);
		},
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dc-field",
				children: [t("serverUrl"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
					name: "serverUrl",
					type: "url",
					required: true,
					placeholder: "https://chat.example.com",
					autoComplete: "url",
					disabled: busy
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dc-field",
				children: [t("inviteCode"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
					name: "inviteCode",
					type: "text",
					autoComplete: "off",
					autoCapitalize: "characters",
					spellCheck: false,
					maxLength: 20,
					placeholder: "ABCD-2345",
					disabled: busy
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				type: "submit",
				variant: "outline",
				disabled: busy,
				children: t(state.busy?.action === "add-server" ? "addingServer" : "addServer")
			})
		]
	});
}
// dsh-connect/client/components/bots.tsx
var STATUS_KEYS = {
	offline: "statusOffline",
	connecting: "statusConnecting",
	online: "statusOnline",
	error: "statusError"
};
function Avatar({ name }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
		className: "dc-avatar",
		"aria-hidden": true,
		children: Array.from(name)[0]
	});
}
/** One Bot account on one chat server: whether it is online there, and the actions that change that. */
function ConnectionRow({ bot, title, connection, state, value, t }) {
	const busy = state.busy?.botId === bot.id;
	const status = bot.status || "offline";
	const connected = bot.connected || status === "online" || status === "connecting";
	const disabled = Boolean(state.busy);
	const name = bot.name || bot.id;
	const catalog = value.models;
	const nextModel = bot.modelSelection || catalog?.defaultSelection;
	const modelAvailable = catalog?.available !== true || catalog.providers.some((provider) => provider.models.some((model) => model.model === nextModel?.model));
	const blocked = disabled || value.runtime?.available === false || !modelAvailable;
	const chat = status === "online" ? webUrl(bot.serverUrl || "") : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-copy",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-title",
					children: title
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-status",
					"data-status": status,
					children: STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status
				}),
				!modelAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-error dc-small",
					children: t("modelUnavailable")
				}),
				bot.lastError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-error dc-small",
					children: bot.lastError
				})
			]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-actions",
			children: [
				chat && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					href: chat,
					target: "_blank",
					rel: "noopener noreferrer",
					children: t("openChat")
				}),
				connected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					type: "button",
					disabled: blocked,
					onClick: () => void connection.reconnect(bot.id),
					"aria-label": t("reconnectBot", { name }),
					children: t(busy && state.busy?.action === "reconnect" ? "reconnecting" : "reconnect")
				}),
				connected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					type: "button",
					disabled,
					onClick: () => void connection.disconnect(bot.id),
					"aria-label": t("disconnectBot", { name }),
					children: t(busy && state.busy?.action === "disconnect" ? "disconnecting" : "disconnect")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					type: "button",
					disabled: blocked,
					onClick: () => void connection.connect(bot.id),
					"aria-label": t("connectBot", { name }),
					children: t(busy ? "connecting" : "connect")
				})
			]
		})]
	});
}
/** A Bot that lives on this device: where it is online, and its settings. */
function LocalBot({ bot, ...props }) {
	const { connection, state, value, t } = props;
	const [settings, setSettings] = (0, react.useState)(false);
	const [serverUrl, setServerUrl] = (0, react.useState)("");
	const links = value.bots.filter((link) => link.nativeBotId === bot.id);
	const servers = value.user ? value.servers || [] : [];
	const target = servers.find((server) => server.url === serverUrl) || servers[0];
	const model = (value.models?.providers || []).flatMap((provider) => provider.models).find((item) => item.model === bot.model);
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-bot",
		"aria-label": bot.name,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-row",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-identity",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Avatar, { name: bot.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dc-copy",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-title",
								children: bot.name
							}),
							bot.role && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-meta",
								children: bot.role
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-meta",
								children: `${t("model")} · ${model?.name || bot.model || t("noModel")}`
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					type: "button",
					"aria-expanded": settings,
					"aria-label": t("botSettings", { name: bot.name }),
					onClick: () => setSettings(!settings),
					children: t(settings ? "closeSettings" : "settings")
				})]
			}),
			links.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-links",
				children: links.map((link) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConnectionRow, {
					bot: link,
					title: link.serverName || link.id,
					...props
				}, link.id))
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dc-links",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-row",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-copy dc-muted",
						children: t(target ? "notJoined" : "signInToAttach")
					}), target && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dc-actions",
						children: [servers.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							"aria-label": t("joinServer"),
							value: target.url,
							onChange: (event) => setServerUrl(event.target.value),
							disabled: busy,
							children: servers.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: server.url,
								children: server.serverName
							}, server.url))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							type: "button",
							disabled: busy || !bot.model,
							"aria-label": t("attachBot", { name: bot.name }),
							onClick: () => void connection.attach(bot.id, void 0, target.url),
							children: t(state.busy?.action === "attach" ? "joining" : "attach")
						})]
					})]
				})
			}),
			settings && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalBotSettings, {
				bot,
				connection,
				t,
				children: links[0] && value.models?.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelForm, {
					bot: links[0],
					...props
				}, JSON.stringify(links[0].modelSelection))
			})
		]
	});
}
/** A Bot account that no Bot on this device runs yet: pick the local Bot that takes it over. */
function UnlinkedBot({ bot, connection, state, value, t }) {
	const [nativeId, setNativeId] = (0, react.useState)("");
	const disabled = Boolean(state.busy);
	const name = bot.name || bot.id;
	const free = (value.nativeBots || []).filter((local) => !value.bots.some((item) => item.nativeBotId === local.id));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-row",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-identity",
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Avatar, { name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-copy",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-title",
					children: name
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-meta",
					children: bot.localpart || bot.id
				})]
			})]
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dc-actions",
			onSubmit: (event) => {
				event.preventDefault();
				connection.attach(nativeId, bot.id);
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				"aria-label": t("bindLabel", { name }),
				value: nativeId,
				onChange: (event) => setNativeId(event.target.value),
				disabled: disabled || !free.length,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "",
					children: t(free.length ? "chooseNative" : "noFreeNative")
				}), free.map((local) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: local.id,
					children: local.name
				}, local.id))]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				type: "submit",
				variant: "outline",
				disabled: disabled || !nativeId,
				children: t("bind")
			})]
		})]
	});
}
/** A Bot the plugin runs as its own process: its account on one chat server, and the model it uses. */
function ServerBotRow({ bot, ...props }) {
	const name = bot.name || bot.id;
	const next = bot.modelSelection || props.value.models?.defaultSelection;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-bot",
		"aria-label": name,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-identity",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Avatar, { name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-copy",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-title",
							children: name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: bot.localpart || bot.id
						}),
						bot.activeModel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: `${props.t("activeModel")} · ${bot.activeModel.model}`
						}),
						next && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: `${props.t("nextModel")} · ${next.model}`
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-links",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConnectionRow, {
					bot,
					title: bot.serverName || bot.id,
					...props
				})
			}),
			props.value.models?.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelForm, {
				bot,
				...props
			}, JSON.stringify(bot.modelSelection))
		]
	});
}
/** Bot accounts grouped by the chat server they are on. */
function ByServer({ bots, listClass, empty, render, value }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: (value.servers || []).map((server) => {
		const mine = bots.filter((bot) => bot.serverUrl === server.url);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "dc-group",
			"aria-label": server.serverName,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: server.serverName }), mine.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: listClass,
				children: mine.map(render)
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: empty
			})]
		}, server.url);
	}) });
}
/**
* The owner's Bots. With the DSCord kernel they live on this device: each one shows where it is online, and new
* ones are created here. Without it, they are the account's Bots on each chat server.
*/
function BotsPanel(props) {
	const { value, t } = props;
	if (!value.nativeMode) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("myBots"),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("myBots") }), value.bots.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "dc-muted",
			children: t("emptyBots")
		}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ByServer, {
			...props,
			bots: value.bots,
			listClass: "dc-bots",
			empty: t("noServerBots"),
			render: (bot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerBotRow, {
				bot,
				...props
			}, bot.id)
		})]
	});
	const local = value.nativeBots || [];
	const unlinked = value.bots.filter((bot, index, all) => !bot.nativeBotId && all.findIndex((item) => item.localpart === bot.localpart) === index);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("nativeBots"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-heading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("nativeBots") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted",
					children: t("nativeHelp")
				})]
			}),
			local.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-bots",
				children: local.map((bot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalBot, {
					bot,
					...props
				}, bot.id))
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("nativeEmpty")
			}),
			unlinked.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dc-section dc-divided",
				"aria-label": t("unlinkedBots"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-heading",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("unlinkedBots") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-meta",
						children: t("unlinkedHelp")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: "dc-list",
					children: unlinked.map((bot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UnlinkedBot, {
						bot,
						...props
					}, bot.id))
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateLocalBot, {
				...props,
				startOpen: Boolean(value.user) && !local.length
			}),
			local.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-meta",
				children: t("nativeLifecycle")
			})
		]
	});
}
// dsh-connect/client/components/page.tsx
var STEPS = [
	["stepAccount", "stepAccountHint"],
	["stepBot", "stepBotHint"],
	["stepOnline", "stepOnlineHint"]
];
/** The three steps from a fresh install to a Bot that answers, shown until the last one is done. */
function SetupGuide({ value, t }) {
	const done = [
		Boolean(value.user),
		Boolean(value.nativeBots?.length || value.bots.length),
		value.bots.some((bot) => bot.connected || bot.status === "online")
	];
	if (done[2]) return null;
	const current = done.indexOf(false);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
		className: "dc-steps",
		"aria-label": t("guideLabel"),
		children: STEPS.map(([title, hint], index) => {
			const state = done[index] ? "done" : index === current ? "current" : "todo";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: "dc-step",
				"data-state": state,
				"aria-current": state === "current" ? "step" : void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-step-mark",
					"aria-hidden": true,
					children: state === "done" ? "✓" : index + 1
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dc-step-copy",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(title) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(state === "done" ? "stepDone" : hint) })]
				})]
			}, title);
		})
	});
}
/** What the last action said, and anything wrong with the connection; it stays in view while the page scrolls. */
function Notices({ state, value, t }) {
	const errorMessage = state.errorTranslation ? t(state.errorTranslation.key, state.errorTranslation.params) : state.error;
	const lastError = value?.lastError && value.lastError !== errorMessage ? value.lastError : null;
	const runtimeDown = value?.runtime?.available === false;
	if (!state.notice && !errorMessage && !lastError && !runtimeDown) return null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dc-notices",
		children: [
			state.notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "dc-notice",
				"data-tone": "success",
				children: t(state.notice)
			}),
			errorMessage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-notice",
				"data-tone": "error",
				children: errorMessage
			}),
			lastError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-notice",
				"data-tone": "error",
				children: lastError
			}),
			runtimeDown && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "dc-notice",
				"data-tone": "error",
				children: value.runtime?.message || t("runtimeUnavailable")
			})
		]
	});
}
/** DSCord's page in DSH: connect the account, run Bots, pick chat servers, then the settings few people need. */
function ConnectionPage({ connection, t }) {
	const state = (0, react.useSyncExternalStore)(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
	const value = state.value;
	const user = value?.user;
	const busy = state.loading || Boolean(state.busy);
	const ready = value ? {
		connection,
		state,
		value,
		t
	} : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dscord-connect",
		"aria-label": t("pageLabel"),
		"aria-busy": busy,
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: styles }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-content",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "dc-header",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dc-toolbar",
						children: [
							user && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dc-account",
								"aria-label": t("account"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-account-name",
									children: user.name || user.id
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-meta",
									children: user.globalId || user.id
								})]
							}),
							user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								type: "button",
								disabled: Boolean(state.busy),
								onClick: () => void connection.logout(),
								children: t(state.busy?.action === "logout" ? "loggingOut" : "logout")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								type: "button",
								disabled: busy,
								onClick: () => void connection.refresh(),
								children: t("refresh")
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Notices, {
					state,
					value,
					t
				}),
				state.loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-muted",
					children: t("readStatus")
				}),
				value?.nativeMode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SetupGuide, {
					value,
					t
				}),
				!state.loading && !user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoginForm, {
					connection,
					state,
					t
				}),
				ready && (ready.value.nativeMode || user) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BotsPanel, { ...ready }, `${ready.value.hostId || "local"}/${user?.id || "local-owner"}`),
				ready && user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServersPanel, { ...ready }),
				value?.kernelUpdates && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KernelUpdatePanel, {
					connection,
					initial: value.kernelUpdates,
					t
				}),
				(value?.nativeMode || value?.dataDirectory) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dc-panel",
					"aria-label": t("advanced"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("advanced") }),
						value.nativeMode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DecisionProviderForm, {
							connection,
							t
						}),
						value.dataDirectory && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigDirectory, {
							directory: value.dataDirectory,
							t
						})
					]
				})
			]
		})]
	});
}
// dsh-connect/client/connection.ts
var SHORT_ACTIONS = [
	"status",
	"login",
	"kernel-state",
	"memory-profile"
];
/** What the page says after an action that changes more than the row it was started from. */
var NOTICES = {
	"save-model": "savedModel",
	"create-native": "localCreated",
	attach: "botJoined"
};
var ERROR_KEYS = {
	MODEL_POLICY_DENIED: "serverPolicyDenied",
	MODEL_OUTPUT_LIMIT: "serverOutputLimit",
	MISSING_CREDENTIAL: "missingCredential",
	INVALID_REASONING_EFFORT: "invalidEffort",
	INVALID_OUTPUT_LIMIT: "invalidOutput",
	INVALID_MODEL: "modelUnavailable",
	MODEL_UNAVAILABLE: "modelUnavailable",
	MODEL_PROVIDER_UNAVAILABLE: "modelUnavailable",
	MODEL_PROFILE_INVALID: "providerInvalid",
	DSCORD_KERNEL_CONFLICT: "kernelConflict",
	CONNECT_KEY_INVALID: "connectKeyInvalid",
	CONNECT_CODE_UNKNOWN: "connectKeyUnknown",
	CONNECT_CODE_EXPIRED: "connectKeyExpired"
};
/**
* The page's one view of the DSH host route: it reads the connection status every five seconds while the page is
* visible, runs one action at a time, and keeps an action's error until the next action or an explicit refresh.
*/
function createConnectionModel(t) {
	let snapshot = {
		value: null,
		busy: null,
		error: null,
		errorTranslation: null,
		loading: true
	};
	const listeners = /* @__PURE__ */ new Set();
	let disposed = false;
	let pollTimer;
	let readController;
	let actionController;
	let revision = 0;
	let errorSource = null;
	let initialStatus = true;
	function clientError(key, params) {
		return Object.assign(new Error(t(key, params)), { translation: {
			key,
			params
		} });
	}
	function publish(update) {
		if (disposed) return;
		snapshot = {
			...snapshot,
			...update
		};
		for (const listener of listeners) listener();
	}
	async function request(action, payload, controller, connectionState = true) {
		const timeoutMs = SHORT_ACTIONS.includes(action) ? 3e4 : 3e5;
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch("api/dscord", {
				method: "POST",
				credentials: "same-origin",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...payload
				}),
				signal: controller.signal
			});
			if (!response.ok) throw Object.assign(clientError("requestHttp", { status: response.status }), { httpStatus: response.status });
			const result = await response.json();
			if (!result.ok) {
				const key = result.error?.code ? ERROR_KEYS[result.error.code] : void 0;
				throw key ? clientError(key) : result.error?.message ? new Error(result.error.message) : clientError("requestFailed");
			}
			if (!result.value || connectionState && !Array.isArray(result.value.bots)) throw clientError("invalidStatus");
			return result.value;
		} catch (error) {
			if (error.name === "AbortError") throw clientError("requestTimeout");
			if (error instanceof TypeError) throw clientError("connectionUnavailable");
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
	async function readStatus(controller) {
		const attempts = initialStatus ? 3 : 1;
		initialStatus = false;
		for (let attempt = 0;; attempt++) try {
			return await request("status", {}, controller);
		} catch (error) {
			if (error.httpStatus !== 404 || attempt + 1 === attempts || controller.signal.aborted) throw error;
			await new Promise((resolve) => setTimeout(resolve, 250));
			controller.signal.throwIfAborted();
		}
	}
	async function refresh({ clearError = true } = {}) {
		if (disposed || snapshot.busy || readController) return;
		const current = revision;
		const controller = new AbortController();
		readController = controller;
		try {
			const value = await readStatus(controller);
			if (current === revision) {
				const error = !clearError && errorSource === "action" ? snapshot.error : null;
				if (!error) errorSource = null;
				publish({
					value,
					loading: false,
					error,
					errorTranslation: error ? snapshot.errorTranslation : null
				});
			}
		} catch (error) {
			if (current === revision) {
				errorSource = "status";
				publish({
					loading: false,
					error: error.message,
					errorTranslation: error.translation || null
				});
			}
		} finally {
			if (readController === controller) readController = void 0;
		}
	}
	async function mutate(action, payload = {}) {
		if (disposed || snapshot.busy) return void 0;
		revision += 1;
		readController?.abort();
		readController = void 0;
		const controller = new AbortController();
		actionController = controller;
		errorSource = null;
		publish({
			busy: {
				action,
				botId: payload.botId
			},
			notice: null,
			error: null,
			errorTranslation: null
		});
		try {
			if (action === "reconnect") {
				publish({ value: await request("disconnect", payload, controller) });
				action = "connect";
			}
			const value = await request(action, payload, controller);
			publish({
				value,
				error: null,
				errorTranslation: null,
				notice: NOTICES[action] || null
			});
			return value;
		} catch (error) {
			errorSource = "action";
			publish({
				error: error.message,
				errorTranslation: error.translation || null
			});
			return;
		} finally {
			actionController = void 0;
			publish({
				busy: null,
				loading: false
			});
		}
	}
	function subscribe(listener) {
		listeners.add(listener);
		if (listeners.size === 1) {
			refresh({ clearError: false });
			pollTimer = setInterval(() => {
				if (document.visibilityState !== "hidden") refresh({ clearError: false });
			}, 5e3);
		}
		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) {
				clearInterval(pollTimer);
				pollTimer = void 0;
			}
		};
	}
	const invite = (inviteCode) => inviteCode ? { inviteCode } : {};
	return {
		getSnapshot: () => snapshot,
		subscribe,
		refresh,
		login: (key) => mutate("login", { key }),
		addServer: (serverUrl, inviteCode = "") => mutate("add-server", {
			serverUrl,
			...invite(inviteCode)
		}),
		searchServers: (query) => request("search-servers", { query }, new AbortController(), false),
		removeServer: (serverUrl) => mutate("remove-server", { serverUrl }),
		logout: () => mutate("logout"),
		saveModel: (botId, selection) => mutate("save-model", {
			botId,
			selection
		}),
		/** Creates a Bot on this device; given a chat server, also adds the new Bot to it and brings it online. */
		createNative: async (payload, serverUrl) => {
			const known = new Set(snapshot.value?.nativeBots?.map((bot) => bot.id));
			const created = await mutate("create-native", payload);
			const bot = created?.nativeBots?.find((item) => !known.has(item.id));
			if (!bot || !serverUrl) return created;
			return await mutate("attach", {
				nativeBotId: bot.id,
				serverUrl
			}) || created;
		},
		kernel: (action, payload = {}, controller = new AbortController()) => request(action, payload, controller, false),
		attach: (nativeBotId, botId, serverUrl) => mutate("attach", {
			nativeBotId,
			...botId ? { botId } : {},
			...serverUrl ? { serverUrl } : {}
		}),
		connect: (botId) => mutate("connect", { botId }),
		disconnect: (botId) => mutate("disconnect", { botId }),
		reconnect: (botId) => mutate("reconnect", { botId }),
		dispose() {
			disposed = true;
			revision += 1;
			clearInterval(pollTimer);
			readController?.abort();
			actionController?.abort();
			listeners.clear();
		}
	};
}
// dsh-connect/client/locale.ts
/** The page's own words, registered with DSH's locale service under one namespace. */
var localeNamespace = "dscord.connection";
var zh = {
	nativeBots: "这台设备上的 Bot",
	nativeHelp: "Bot 运行在这台设备的 DSH 里，身份、记忆和工作都留在本机。加入聊天服务器后，就能在频道里被 @ 和私聊。",
	nativeEmpty: "这台设备上还没有 Bot。",
	attach: "加入并上线",
	bind: "绑定并上线",
	chooseNative: "选择本机 Bot",
	nativeLifecycle: "断开只是让 Bot 离开服务器，它在本机的对话、记忆和工作都会保留。",
	newBot: "创建 Bot",
	createLocal: "创建到这台设备",
	creatingLocal: "正在创建…",
	botName: "名称",
	botRole: "职责或介绍（可选）",
	localCreated: "Bot 已创建。",
	settings: "设置",
	stableIdentity: "本机身份",
	creationPending: "创建结果待确认。请先刷新 Bot 列表；重试会核对同一次创建。",
	confirmCreation: "核对同次创建",
	participation: "参与方式",
	mention: "点名回应",
	shadow: "安静观察",
	natural: "自然参与",
	mentionHelp: "被 @ 或收到私聊时回应。",
	shadowHelp: "观察对话并形成判断，暂不主动发言。",
	naturalHelp: "判断什么时候补充、等待或继续倾听。",
	saveParticipation: "保存参与方式",
	participationSaved: "参与方式已保存",
	participationPending: "已保存，Bot 下次同步时生效。",
	listening: "正在倾听",
	waiting: "正在等待",
	working: "正在工作",
	speaking: "准备发言",
	unknown: "未知",
	decisionTitle: "参与判断服务",
	decisionApiKey: "判断服务 API key",
	decisionKeyHelp: "只保存在这台设备。已保存的 key 不会再显示，留空则保留现有的 key。",
	enableDecision: "启用自然参与判断",
	saveDecision: "保存判断服务",
	configured: "已配置",
	notConfigured: "未配置",
	available: "可用",
	availabilityUnknown: "可用状态未知",
	decisionSaved: "判断服务已保存",
	serviceUnavailable: "不可用",
	limitedMemory: "此视图仅覆盖这个 Bot 观察到的内容。",
	shortenedMemory: "此视图已裁剪，可缩小搜索范围。",
	memory: "记忆",
	people: "人物",
	projects: "项目",
	memorySearch: "搜索人物或项目",
	search: "搜索",
	noMemory: "没有匹配的记忆记录。",
	memoryHelp: "每个 Bot 保留自己的认识。来源范围不表示所有成员都知道或认同。",
	currentClaims: "当前陈述",
	preferences: "偏好",
	projectFacts: "项目事实",
	changes: "已变化或历史陈述",
	sources: "来源",
	statement: "陈述",
	proposal: "提议",
	confirmed: "已确认",
	uncertain: "待确认",
	stated: "直接陈述",
	reported: "转述",
	observation: "观察",
	inference: "推断",
	legacy: "历史导入",
	conflicts: "存在未解决冲突",
	noSources: "此记录没有可展示的来源详情。",
	loadingKernel: "正在读取 Bot 状态…",
	signInToAttach: "连接账号后可以加入聊天服务器。",
	kernelConflict: "这台设备正在运行旧的 Bot 内核。请先停用旧插件，按迁移说明启用 DSCord。",
	serverPolicyDenied: "此服务器未允许所选模型，请选择获准模型或联系管理员。",
	serverOutputLimit: "模型输出上限超过服务器额度，请检查 DSH 与服务器的配置。",
	model: "模型",
	noModel: "选择模型",
	saveModel: "保存选择",
	savedModel: "模型选择已保存。",
	activeModel: "当前运行",
	nextModel: "已选模型",
	modelPending: "点击重连应用新模型。重连会停止当前任务。",
	modelUnavailable: "此模型在 DSH 中不可用，请到 DSH 模型设置检查。",
	missingCredential: "请在 DSH 的模型设置中配置此模型的凭据。",
	invalidEffort: "请检查 DSH 中的模型思考强度设置。",
	invalidOutput: "输出 tokens 必须为正整数。",
	providerInvalid: "请检查 DSH 中的模型配置。",
	title: "DSCord",
	pageLabel: "DSCord 连接",
	loginTitle: "连接 DSCord 账号",
	serverUrl: "服务器地址",
	connectionKey: "连接密钥",
	login: "连接",
	loggingIn: "正在连接…",
	connectKeyInvalid: "连接密钥不完整，请从 DSCord 网页重新复制。",
	connectKeyUnknown: "连接密钥已用过或不存在，请在网页上重新生成。",
	connectKeyExpired: "连接密钥已过期，请在网页上重新生成。",
	disconnect: "断开",
	disconnecting: "正在断开…",
	disconnectBot: "断开 {name}",
	connect: "上线",
	connecting: "正在连接…",
	connectBot: "上线 {name}",
	reconnect: "重连",
	reconnecting: "正在重连…",
	reconnectBot: "重新连接 {name}",
	statusOffline: "未上线",
	statusConnecting: "正在连接",
	statusOnline: "已上线",
	statusError: "连接失败",
	openWeb: "打开网页",
	refresh: "刷新",
	readStatus: "正在读取连接状态…",
	servers: "聊天服务器",
	serversHelp: "Bot 可以加入多台聊天服务器，在每台服务器上分别上线。",
	addServer: "添加服务器",
	addingServer: "正在添加…",
	searchServers: "搜索服务器",
	searchServersHelp: "在中央服务器的索引里按名称、主题、标签或服务器号找服务器。",
	searchQuery: "搜索",
	searchingServers: "正在搜索…",
	noServerResults: "没有符合的服务器",
	serverAdded: "已添加",
	addThisServer: "添加",
	serverMembers: "{people} 人 · {bots} 个 Bot",
	addServerLabel: "添加 {server}",
	serverNumber: "号码 {number}",
	inviteOnly: "只凭邀请加入",
	inviteOnlyHint: "这台服务器只接受邀请：在下面填它的地址和成员给你的邀请码。",
	removeServer: "移除",
	removeServerLabel: "移除 {server}",
	noServerBots: "这台服务器上还没有你的 Bot。",
	runtimeUnavailable: "Bot 运行环境暂不可用",
	account: "当前账号",
	logout: "退出登录",
	loggingOut: "正在退出…",
	myBots: "我的 Bot",
	emptyBots: "这个账号还没有 Bot。",
	configDirectory: "本机配置目录",
	requestHttp: "DSH 请求失败（HTTP {status}）",
	requestFailed: "操作失败，请重试",
	invalidStatus: "DSH 返回的连接状态不完整",
	requestTimeout: "请求超时，请刷新连接状态",
	connectionUnavailable: "无法连接 DSH，请检查宿主是否正在运行",
	updateTitle: "插件版本",
	updateCurrent: "当前版本 {version}",
	updateProtocol: "服务器节点协议 {protocol}",
	updateIncompatible: "当前插件不支持此服务器的节点协议，需要换到兼容的版本。",
	updateAvailable: "可以换到 {version}",
	updateLatest: "已是兼容此服务器的最新版本。",
	updateUnchecked: "连上服务器后检查兼容版本。",
	updatePolicy: "升级方式",
	policyAuto: "自动升级",
	policyNotify: "有新版本时提示",
	policyManual: "手动检查",
	policyAutoHelp: "Bot 空闲时自动安装兼容此服务器的最新版本。",
	policyNotifyHelp: "定期检查，由你决定何时安装。",
	policyManualHelp: "只在你点检查时查找新版本。",
	updatePrerelease: "包含预发布版本",
	updateCheck: "检查更新",
	updateInstall: "安装 {version}",
	updateInstalling: "正在安装…",
	updateInstalled: "新版本已安装。",
	updateRestart: "新版本已安装，重启 DSH 后生效。",
	updateFailed: "安装失败：{error}",
	updateNotRegistry: "插件不是从 npm 安装的，请手动安装新版本。",
	attachBot: "让 {name} 加入并上线",
	joining: "正在上线…",
	notJoined: "还没有加入聊天服务器",
	joinServer: "加入的服务器",
	bindLabel: "运行 {name} 的本机 Bot",
	noFreeNative: "先创建一个本机 Bot",
	unlinkedBots: "账号里的其他 Bot",
	unlinkedHelp: "这些 Bot 账号还没有在这台设备上运行。选一个本机 Bot 接管它，它就从这里上线。",
	createAndJoin: "创建并上线",
	botNamePlaceholder: "例如：小助手",
	botRolePlaceholder: "例如：帮我整理会议纪要和待办",
	botJoined: "Bot 已上线，可以去聊天服务器里 @ 它或私聊它。",
	openChat: "去聊天",
	closeSettings: "收起设置",
	botSettings: "{name} 的设置",
	activity: "当前状态",
	decisionHelp: "「自然参与」的 Bot 用这个服务判断什么时候该说话。",
	modelsMissing: "还没有可用的模型。请先在 DSH 的模型设置里添加模型，再回来创建 Bot。",
	loginStep1: "在 DSCord 网页点「添加 Bot」，或打开「设置 → 账号 → 连接 DSH」。",
	loginStep2: "点「复制连接密钥」。",
	loginStep3: "回到这里粘贴，粘贴后自动连接。",
	keyPlaceholder: "在这里粘贴连接密钥",
	keyHint: "密钥 10 分钟内有效，只能用一次。",
	noServers: "还没有聊天服务器。搜索一台，或者填它的地址。",
	addByAddress: "或者直接填服务器地址：",
	inviteCode: "邀请码（可选）",
	advanced: "更多设置",
	guideLabel: "开始使用",
	stepAccount: "连接账号",
	stepAccountHint: "粘贴网页上复制的连接密钥",
	stepBot: "创建 Bot",
	stepBotHint: "起个名字，选好模型",
	stepOnline: "上线",
	stepOnlineHint: "加入聊天服务器，开始对话",
	stepDone: "已完成"
};
var en = {
	nativeBots: "Bots on this device",
	nativeHelp: "Bots run in DSH on this device and keep their identity, memory and work here. Once a Bot joins a chat server, people can mention it in channels and message it.",
	nativeEmpty: "There are no Bots on this device yet.",
	attach: "Join and go online",
	bind: "Bind and go online",
	chooseNative: "Choose a local Bot",
	nativeLifecycle: "Disconnecting only takes the Bot off the server. Its chats, memory and work stay on this device.",
	newBot: "Create Bot",
	createLocal: "Create on this device",
	creatingLocal: "Creating…",
	botName: "Name",
	botRole: "Role or introduction (optional)",
	localCreated: "Bot created.",
	settings: "Settings",
	stableIdentity: "Local identity",
	creationPending: "Creation is awaiting confirmation. Refresh the Bot list first; retrying confirms the same request.",
	confirmCreation: "Confirm same creation",
	participation: "Participation",
	mention: "When mentioned",
	shadow: "Observe quietly",
	natural: "Join naturally",
	mentionHelp: "Respond to mentions and direct messages.",
	shadowHelp: "Observe and form judgments, while holding back proactive replies.",
	naturalHelp: "Decide when to contribute, wait, or keep listening.",
	saveParticipation: "Save participation",
	participationSaved: "Participation saved",
	participationPending: "Saved. The Bot applies this at its next update.",
	listening: "Listening",
	waiting: "Waiting",
	working: "Working",
	speaking: "Speaking",
	unknown: "Unknown",
	decisionTitle: "Participation service",
	decisionApiKey: "Decision service API key",
	decisionKeyHelp: "Stored only on this device. A saved key is never shown again; leave this blank to keep it.",
	enableDecision: "Enable natural participation decisions",
	saveDecision: "Save participation service",
	configured: "Configured",
	notConfigured: "Not configured",
	available: "Available",
	availabilityUnknown: "Availability unknown",
	decisionSaved: "Participation service saved",
	serviceUnavailable: "Unavailable",
	limitedMemory: "This view covers only what this Bot has observed.",
	shortenedMemory: "This view was shortened. Refine your search to focus it.",
	memory: "Memory",
	people: "People",
	projects: "Projects",
	memorySearch: "Search people or projects",
	search: "Search",
	noMemory: "No matching memory records.",
	memoryHelp: "Each Bot has its own view. A shared source scope does not mean everyone knows or agrees with it.",
	currentClaims: "Current claims",
	preferences: "Preferences",
	projectFacts: "Project facts",
	changes: "Changed or historical claims",
	sources: "Sources",
	statement: "Statement",
	proposal: "Proposal",
	confirmed: "Confirmed",
	uncertain: "Uncertain",
	stated: "Direct statement",
	reported: "Reported",
	observation: "Observation",
	inference: "Inference",
	legacy: "Legacy record",
	conflicts: "Unresolved conflict",
	noSources: "No source details are available for this record.",
	loadingKernel: "Loading Bot status…",
	signInToAttach: "Connect your account to add it to a chat server.",
	kernelConflict: "An older Bot kernel is running on this device. Stop its plugin and follow the migration instructions to enable DSCord.",
	serverPolicyDenied: "This server does not allow the selected model. Choose an allowed model or contact its administrator.",
	serverOutputLimit: "The model output limit exceeds this server’s budget. Check the DSH and server configuration.",
	model: "Model",
	noModel: "Choose a model",
	saveModel: "Save selection",
	savedModel: "Model selection saved.",
	activeModel: "Running model",
	nextModel: "Selected model",
	modelPending: "Reconnect to apply the new model. Reconnecting stops the current task.",
	modelUnavailable: "This model is unavailable in DSH. Check DSH model settings.",
	missingCredential: "Configure this model’s credentials in DSH model settings.",
	invalidEffort: "Check the thinking level in DSH model settings.",
	invalidOutput: "Output tokens must be a positive integer.",
	providerInvalid: "Check the model configuration in DSH.",
	title: "DSCord",
	pageLabel: "DSCord connection",
	loginTitle: "Connect your DSCord account",
	serverUrl: "Server URL",
	connectionKey: "Connection key",
	login: "Connect",
	loggingIn: "Connecting…",
	connectKeyInvalid: "This connection key is incomplete. Copy it again from the DSCord web page.",
	connectKeyUnknown: "This connection key was already used or does not exist. Make a new one on the web page.",
	connectKeyExpired: "This connection key has expired. Make a new one on the web page.",
	disconnect: "Disconnect",
	disconnecting: "Disconnecting…",
	disconnectBot: "Disconnect {name}",
	connect: "Connect",
	connecting: "Connecting…",
	connectBot: "Connect {name}",
	reconnect: "Reconnect",
	reconnecting: "Reconnecting…",
	reconnectBot: "Reconnect {name}",
	statusOffline: "Offline",
	statusConnecting: "Connecting",
	statusOnline: "Online",
	statusError: "Connection failed",
	openWeb: "Open website",
	refresh: "Refresh",
	readStatus: "Loading connection status…",
	servers: "Chat servers",
	serversHelp: "A Bot can join several chat servers and goes online on each one separately.",
	addServer: "Add server",
	addingServer: "Adding…",
	searchServers: "Search servers",
	searchServersHelp: "Find servers in the central index by name, topic, tag or server number.",
	searchQuery: "Search",
	searchingServers: "Searching…",
	noServerResults: "No listed server matches",
	serverAdded: "Added",
	addThisServer: "Add",
	serverMembers: "{people} people · {bots} Bots",
	addServerLabel: "Add {server}",
	serverNumber: "No. {number}",
	inviteOnly: "Invitation only",
	inviteOnlyHint: "This server only takes invited people: enter its address below with the code a member gave you.",
	removeServer: "Remove",
	removeServerLabel: "Remove {server}",
	noServerBots: "You have no Bots on this server yet.",
	runtimeUnavailable: "The Bot runtime is currently unavailable",
	account: "Current account",
	logout: "Sign out",
	loggingOut: "Signing out…",
	myBots: "My Bots",
	emptyBots: "This account has no Bots yet.",
	configDirectory: "Local configuration directory",
	requestHttp: "DSH request failed (HTTP {status})",
	requestFailed: "The operation failed. Please try again.",
	invalidStatus: "DSH returned incomplete connection status",
	requestTimeout: "The request timed out. Refresh the connection status.",
	connectionUnavailable: "Cannot reach DSH. Check that the host is running.",
	updateTitle: "Plugin version",
	updateCurrent: "Current version {version}",
	updateProtocol: "Server node protocol {protocol}",
	updateIncompatible: "This plugin does not speak the server’s node protocol. Switch to a compatible version.",
	updateAvailable: "{version} is available",
	updateLatest: "This is the newest version that works with this server.",
	updateUnchecked: "Compatible versions are checked once a server is connected.",
	updatePolicy: "Upgrades",
	policyAuto: "Upgrade automatically",
	policyNotify: "Tell me about new versions",
	policyManual: "Check by hand",
	policyAutoHelp: "Install the newest version that works with this server while Bots are idle.",
	policyNotifyHelp: "Check regularly and let you decide when to install.",
	policyManualHelp: "Look for new versions only when you check.",
	updatePrerelease: "Include prereleases",
	updateCheck: "Check for updates",
	updateInstall: "Install {version}",
	updateInstalling: "Installing…",
	updateInstalled: "The new version is installed.",
	updateRestart: "The new version is installed. Restart DSH to use it.",
	updateFailed: "Install failed: {error}",
	updateNotRegistry: "This plugin was not installed from npm. Install the new version by hand.",
	attachBot: "Add {name} and go online",
	joining: "Going online…",
	notJoined: "Not on a chat server yet",
	joinServer: "Server to join",
	bindLabel: "Local Bot that runs {name}",
	noFreeNative: "Create a local Bot first",
	unlinkedBots: "Other Bots in your account",
	unlinkedHelp: "No Bot on this device runs these accounts yet. Pick a local Bot to take one over and it goes online from here.",
	createAndJoin: "Create and go online",
	botNamePlaceholder: "For example: Helper",
	botRolePlaceholder: "For example: keeps meeting notes and follow-ups",
	botJoined: "The Bot is online. Mention it or message it on the chat server.",
	openChat: "Open chat",
	closeSettings: "Hide settings",
	botSettings: "Settings for {name}",
	activity: "Now",
	decisionHelp: "Bots that join naturally use this service to decide when to speak.",
	modelsMissing: "No model is available yet. Add one in DSH model settings, then come back to create a Bot.",
	loginStep1: "On the DSCord web page, choose “Add a Bot”, or open Settings → Account → Connect DSH.",
	loginStep2: "Choose “Copy connection key”.",
	loginStep3: "Paste it here. It connects as soon as you paste.",
	keyPlaceholder: "Paste the connection key here",
	keyHint: "A key works once, within 10 minutes.",
	noServers: "No chat servers yet. Search for one, or enter its address.",
	addByAddress: "Or enter a server address:",
	inviteCode: "Invitation code (optional)",
	advanced: "More settings",
	guideLabel: "Getting started",
	stepAccount: "Connect your account",
	stepAccountHint: "Paste the key copied from the web page",
	stepBot: "Create a Bot",
	stepBotHint: "Give it a name and a model",
	stepOnline: "Go online",
	stepOnlineHint: "Join a chat server and start talking",
	stepDone: "Done"
};
// dsh-connect/client/mark.png
var mark_default = "data:image/png;base64,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";
// dsh-connect/client/index.tsx
var panelId = "dscord";
var inject = [
	"slots",
	"locale",
	"layout"
];
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(localeNamespace, {
		zh,
		en
	}), "dscord: dictionaries");
	const t = ctx.locale.bind(localeNamespace);
	const connection = createConnectionModel(t);
	if (typeof dscordNativeFactory === "function") {
		const factory = dscordNativeFactory;
		let mounted = false;
		const unsubscribe = connection.subscribe(() => {
			if (!mounted && connection.getSnapshot().value?.nativeBundled) {
				mounted = true;
				ctx.plugin(factory(require));
			}
		});
		ctx.effect(() => unsubscribe, "dscord: native Bot interface");
	}
	ctx.effect(() => () => connection.dispose(), "dscord: connection page");
	const injectPage = () => ({ connection });
	/** DSCord's own mark, at the size DSH draws sidebar icons. */
	function SidebarIcon({ size = 16 }) {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
			src: mark_default,
			width: size,
			height: size,
			alt: "",
			draggable: false,
			style: { display: "block" }
		});
	}
	function NativeShortcutButton({ face }) {
		if ((0, react.useSyncExternalStore)(face.hooks.surface.subscribe, () => face.hooks.surface.getSnapshot().mode) !== "bot") return null;
		return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: {
				position: "fixed",
				left: 56,
				bottom: 16,
				zIndex: 50,
				pointerEvents: "auto"
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				type: "button",
				onClick: () => {
					face.actions.setSurface("agent");
					ctx.layout.selectPanel(panelId);
				},
				children: t("title")
			})
		}), document.body);
	}
	function NativeShortcut() {
		const face = (0, react.useSyncExternalStore)((listener) => ctx.slots.subscribe("sidebar.footer.action", listener), () => ctx.slots.entries("sidebar.footer.action").find((item) => item.options?.id === "bot-return"))?.inject?.();
		return face?.actions?.setSurface && face.hooks?.surface ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeShortcutButton, { face }) : null;
	}
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: panelId,
		locale: localeNamespace,
		inject: injectPage
	}, ConnectionPage));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: panelId,
		label: () => t("title"),
		locale: localeNamespace,
		order: 20
	}, SidebarIcon));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: panelId,
		order: 65,
		locale: localeNamespace
	}, NativeShortcut));
	ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
		name: "plugins.bundle.config",
		key: panelId,
		locale: localeNamespace,
		inject: injectPage
	}, ConnectionPage));
}
exports.apply = apply;
exports.inject = inject;
    return module.exports;
  },
});
