// Generated from dsh-connect/client/ by `npm run build:dsh-client` (scripts/build-dsh-client.mjs). Do not edit by hand.
window.__ModuleLoader__.load({
  id: 'dscord',
  factory(require) {
    const module = { exports: {} };
    const exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let react = require("react");
let react_dom = require("react-dom");
let react_jsx_runtime = require("react/jsx-runtime");
// dsh-connect/client/components/controls.tsx
var classes = (...names) => names.filter(Boolean).join(" ");
/**
* DSCord's own controls for the page inside DSH. They are plain elements carrying the design system's class
* names, so the rules generated from ui/styles.css draw them exactly as ui/controls.tsx is drawn on the web
* pages, whatever DSH's own controls look like.
*/
function Button({ variant = "default", size = "default", className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
		"data-slot": "button",
		className: classes("ds-button", `ds-button-${variant}`, `ds-button-size-${size}`, className),
		...props
	});
}
function Input({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		"data-slot": "input",
		className: classes("ds-input", className),
		...props
	});
}
function Textarea({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
		"data-slot": "textarea",
		className: classes("ds-input ds-textarea", className),
		...props
	});
}
function Select({ className, ...props }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
		className: "ds-select-wrap",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
			"data-slot": "select",
			className: classes("ds-input ds-select", className),
			...props
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "2",
			"aria-hidden": "true",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
		})]
	});
}
/** A native checkbox, so it submits and resets with its form; styles.ts draws its checked state. */
function Checkbox(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		type: "checkbox",
		"data-slot": "checkbox",
		className: "ds-checkbox",
		...props
	});
}
function Radio(props) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
		type: "radio",
		"data-slot": "radio",
		className: "ds-radio",
		...props
	});
}
// dsh-connect/client/styles.ts
var base = `
.dscord-ui {
  color-scheme: light;
  --font-family-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
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
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-server: 16px;
  --radius-pill: 999px;
  --radius-round: 50%;
  --height-header: 49px;
  --size-icon: 20px;
  --size-avatar: 32px;
  --size-avatar-message: 40px;
  --width-server-rail: 72px;
  --width-channel-sidebar: 240px;
  --width-member-sidebar: 240px;
  --focus-width: 2px;
  --motion-fast: 150ms;
  --motion-panel: 180ms;
  --motion-highlight: 3s;
  --z-message-actions: 1;
  --z-header: 2;
  --z-floating: 3;
  --z-backdrop: 5;
  --z-panel: 6;
  --z-navigation: 7;
  --z-suggestions: 12;
  --z-drop-target: 20;
  --z-toast: 50;
  --z-ui-popover: 80;
  --z-ui-dialog-backdrop: 90;
  --z-ui-dialog: 91;
  --color-bg-canvas: #e3e5e8;
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f2f3f5;
  --color-bg-tertiary: #e7e9ec;
  --color-bg-input: #ebedef;
  --color-bg-hover: #e7e9ec;
  --color-bg-selected: #dce0e5;
  --color-bg-message-hover: #f2f3f5;
  --color-bg-neutral: #d4d7dc;
  --color-bg-neutral-hover: #c7ccd4;
  --color-bg-toast: #313338;
  --color-text-primary: #060607;
  --color-text-normal: #313338;
  --color-text-secondary: #4e5058;
  --color-text-muted: #5c6069;
  --color-text-on-accent: #ffffff;
  --color-document-paper: #ffffff;
  --color-icon-muted: #6d6f78;
  --color-link: #0068a8;
  --color-focus: #0068a8;
  --color-border-subtle: #e0e2e6;
  --color-border-normal: #cdd1d7;
  --color-border-strong: #a7adb8;
  --color-border-header: #d7dbe0;
  --color-border-divider: #dce0e5;
  --color-border-inset: #d7dbe0;
  --palette-indigo: #5865f2;
  --palette-blue: #2563eb;
  --palette-teal: #0f766e;
  --palette-rose: #be185d;
  --palette-amber: #b45309;
  --color-accent: var(--palette-indigo);
  --color-accent-hover: #4752c4;
  --color-status-success: #008642;
  --color-status-warning: #997000;
  --color-status-danger: #d72f36;
  --color-danger-action: #da373c;
  --color-text-danger: #c92d35;
  --color-text-danger-soft: #9c2026;
  --color-bg-danger: #fde7e8;
  --color-border-danger: #c7474e;
  --color-text-bot: #1d7562;
  --color-code-keyword: #cf222e;
  --color-code-string: #0a3069;
  --color-code-comment: #6e7781;
  --color-code-number: #0550ae;
  --color-code-title: #8250df;
  --color-code-attribute: #953800;
  --color-code-added: #116329;
  --color-code-deleted: #82071e;
  --color-quote-border: var(--color-bg-neutral);
  --color-mention-bg: #5865f224;
  --color-mention-text: #3b48b4;
  --color-mention-message-bg: #f0b2321a;
  --color-mention-message-hover: #f0b2322b;
  --color-message-highlight: #5865f233;
  --color-drop-background: #5865f2ed;
  --color-drop-border: #b8bfff;
  --color-file-pdf-border: #b13036;
  --color-file-image: #3457ab;
  --color-file-text: #24754d;
  --color-file-text-border: #438b68;
  --color-avatar-human: #9255a5;
  --color-avatar-bot: #3b8d7b;
  --color-avatar-alternate: #5865f2;
  --color-role-default: #6d6f78;
  --color-scrollbar-thumb: #c4c9d1;
  --color-overlay: #00000033;
  --color-dialog-overlay: #00000066;
  --shadow-header: 0 1px 3px #00000015;
  --shadow-actions: 0 2px 5px #00000022;
  --shadow-float: 0 3px 10px #00000022;
  --shadow-suggestions: 0 6px 24px #00000026;
  --shadow-panel: -5px 0 20px #00000022;
  --shadow-navigation: 4px 0 20px #00000022;
  --shadow-dialog: 0 12px 48px #00000033;
  --shadow-toast: 0 3px 20px #00000033;
  --green: var(--color-accent);
  --muted: var(--color-text-muted);
  --line: var(--color-border-subtle);
  --surface: var(--color-bg-primary);
  --side: var(--color-bg-secondary);
  --accent: var(--color-accent);
}
body[data-ds-dark-theme] .dscord-ui {
  color-scheme: dark;
  --color-bg-canvas: #1e1f22;
  --color-bg-primary: #313338;
  --color-bg-secondary: #2b2d31;
  --color-bg-tertiary: #232428;
  --color-bg-input: #383a40;
  --color-bg-hover: #35373c;
  --color-bg-selected: #404249;
  --color-bg-message-hover: #2e3035;
  --color-bg-neutral: #4e5058;
  --color-bg-neutral-hover: #6d6f78;
  --color-bg-toast: #111214;
  --color-text-primary: #f2f3f5;
  --color-text-normal: #dbdee1;
  --color-text-secondary: #b5bac1;
  --color-text-muted: #949ba4;
  --color-icon-muted: #80848e;
  --color-link: #00a8fc;
  --color-focus: #00a8fc;
  --color-border-subtle: #3f4147;
  --color-border-normal: #45474e;
  --color-border-strong: #53565f;
  --color-border-header: #26272c;
  --color-border-divider: #42444a;
  --color-border-inset: #25262b;
  --color-status-success: #23a559;
  --color-status-warning: #f0b232;
  --color-status-danger: #f23f43;
  --color-text-danger: #fa777c;
  --color-text-danger-soft: #f2a9ab;
  --color-bg-danger: #5b3335;
  --color-border-danger: #b74348;
  --color-text-bot: #82c7b7;
  --color-code-keyword: #ff7b72;
  --color-code-string: #a5d6ff;
  --color-code-comment: #8b949e;
  --color-code-number: #79c0ff;
  --color-code-title: #d2a8ff;
  --color-code-attribute: #ffa657;
  --color-code-added: #7ee787;
  --color-code-deleted: #ffa198;
  --color-mention-bg: #5865f24d;
  --color-mention-text: #c9cdfb;
  --color-mention-message-bg: #f0b2320c;
  --color-mention-message-hover: #f0b23215;
  --color-message-highlight: #5865f259;
  --color-file-pdf-border: #da686e;
  --color-file-image: #95baff;
  --color-file-text: #8ed8b3;
  --color-file-text-border: #438b68;
  --color-role-default: #99aab5;
  --color-scrollbar-thumb: #1a1b1e;
  --color-overlay: #00000077;
  --color-dialog-overlay: #000000aa;
  --shadow-header: 0 1px 3px #00000022;
  --shadow-actions: 0 2px 5px #00000044;
  --shadow-float: 0 3px 10px #00000033;
  --shadow-suggestions: 0 6px 24px #00000066;
  --shadow-panel: -5px 0 20px #00000044;
  --shadow-navigation: 4px 0 20px #00000044;
  --shadow-dialog: 0 12px 48px #00000077;
  --shadow-toast: 0 3px 20px #00000066;
}
@media (prefers-reduced-motion: reduce) {
  .dscord-ui { --motion-fast: 0ms; --motion-panel: 0ms; --motion-highlight: 0ms; }
}
.dscord-ui .ds-button { min-height: 38px; padding: 0 14px; border: 1px solid transparent; border-radius: var(--radius-md); font-size: var(--font-size-compact); font-weight: var(--font-weight-semibold); line-height: 1.25; cursor: pointer; }
.dscord-ui .ds-button-size-sm { min-height: 34px; padding-inline: 11px; }
.dscord-ui .ds-button-size-icon { width: 36px; min-height: 36px; padding: 0; }
.dscord-ui .ds-button svg { width: 16px; height: 16px; stroke-width: 2; }
.dscord-ui .ds-button-size-icon svg { width: 20px; height: 20px; }
.dscord-ui .ds-button-default { background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-ui .ds-button-default:hover:not(:disabled) { background: var(--color-accent-hover); }
.dscord-ui .ds-button-secondary { background: var(--color-bg-neutral); color: var(--color-text-primary); }
.dscord-ui .ds-button-secondary:hover:not(:disabled) { background: var(--color-bg-neutral-hover); }
.dscord-ui .ds-button-ghost { background: transparent; color: var(--color-text-secondary); }
.dscord-ui .ds-button-ghost:hover:not(:disabled) { background: var(--color-bg-hover); color: var(--color-text-primary); }
.dscord-ui .ds-button-destructive { background: var(--color-bg-danger); color: var(--color-text-danger); }
.dscord-ui .ds-button-destructive:hover:not(:disabled) { background: var(--color-border-danger); color: var(--color-text-on-accent); }
.dscord-ui .ds-button:focus-visible, .dscord-ui .ds-input:focus-visible, .dscord-ui .ds-popover-content:focus-visible, .dscord-ui .ds-dialog-content:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: 2px; }
.dscord-ui .ds-button:disabled, .dscord-ui .ds-input:disabled { cursor: default; opacity: var(--opacity-disabled); }
.dscord-ui .ds-input { min-height: 38px; padding: 8px 11px; border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-input); color: var(--color-text-primary); font: inherit; font-size: var(--font-size-compact); }
.dscord-ui .ds-input::placeholder { color: var(--color-text-muted); }
.dscord-ui .ds-input[aria-invalid="true"], .dscord-ui .ds-input:user-invalid { border-color: var(--color-border-danger); }
.dscord-ui .ds-select-wrap { position: relative; display: block; width: 100%; min-width: 0; }
.dscord-ui .ds-select { appearance: none; padding-right: 34px; cursor: pointer; }
.dscord-ui .ds-select-wrap > svg { position: absolute; top: 50%; right: 11px; transform: translateY(-50%); width: 16px; height: 16px; pointer-events: none; color: var(--color-text-secondary); }
.dscord-ui .ds-select:disabled { cursor: default; }
.dscord-ui .ds-select-wrap:has(.ds-select:disabled) > svg { opacity: var(--opacity-disabled); }
.dscord-ui .ds-textarea { min-height: 92px; resize: vertical; line-height: var(--line-height-body); }
.dscord-ui .ds-checkbox, .dscord-ui .ds-radio { display: inline-grid; place-items: center; flex: 0 0 16px; width: 16px; height: 16px; margin: 0; padding: 0; border: 1px solid var(--color-border-strong); background: var(--color-bg-input); cursor: pointer; vertical-align: middle; }
.dscord-ui .ds-checkbox { border-radius: var(--radius-sm); }
.dscord-ui .ds-radio { border-radius: var(--radius-round); }
.dscord-ui .ds-checkbox[data-checked] { border-color: var(--color-accent); background: var(--color-accent); }
.dscord-ui .ds-checkbox-indicator { display: grid; place-items: center; color: var(--color-text-on-accent); }
.dscord-ui .ds-checkbox-indicator svg { width: 12px; height: 12px; }
.dscord-ui .ds-radio[data-checked] { border-color: var(--color-accent); }
.dscord-ui .ds-radio-indicator { width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); }
.dscord-ui .ds-checkbox:focus-visible, .dscord-ui .ds-radio:focus-visible, .dscord-ui .ds-color-input:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: 2px; }
.dscord-ui .ds-checkbox[data-disabled], .dscord-ui .ds-radio[data-disabled] { opacity: var(--opacity-disabled); cursor: default; }
.dscord-ui .ds-color-input { width: 54px; min-height: 38px; padding: 3px; border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-input); cursor: pointer; }
.dscord-ui .ds-color-input:disabled { opacity: var(--opacity-disabled); cursor: default; }
.dscord-ui .ds-popover-positioner { z-index: var(--z-ui-popover); max-width: calc(100vw - 16px); }
.dscord-ui .ds-popover-content { max-height: min(760px, calc(100dvh - 24px)); overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--color-border-normal); border-radius: var(--radius-xl); background: var(--color-bg-primary); color: var(--color-text-normal); box-shadow: var(--shadow-suggestions); }
.dscord-ui .ds-dialog-backdrop { position: fixed; inset: 0; z-index: var(--z-ui-dialog-backdrop); background: var(--color-dialog-overlay); }
.dscord-ui .ds-dialog-content { position: fixed; top: 50%; left: 50%; z-index: var(--z-ui-dialog); transform: translate(-50%, -50%); max-height: calc(100dvh - 32px); overflow: hidden; overscroll-behavior: contain; border: 1px solid var(--color-border-normal); border-radius: var(--radius-xl); background: var(--color-bg-primary); color: var(--color-text-normal); box-shadow: var(--shadow-dialog); }
.dscord-ui .ds-dialog-content[data-open] { display: flex; flex-direction: column; }
@media (max-width: 480px) {
  .dscord-ui .ds-dialog-content { width: calc(100vw - 16px); max-height: calc(100dvh - 16px); }
}

.dscord-ui { font-family: var(--font-family-ui); font-synthesis: none; }
.dscord-ui, .dscord-ui *, .dscord-ui *::before, .dscord-ui *::after { box-sizing: border-box; }
.dscord-ui .ds-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: var(--space-4); margin: 0; font-family: inherit; white-space: nowrap; user-select: none; transition: background-color var(--motion-fast), color var(--motion-fast); }
.dscord-ui .ds-input { display: block; width: 100%; min-width: 0; margin: 0; outline: none; }
.dscord-ui input:is(.ds-checkbox, .ds-radio) { appearance: none; -webkit-appearance: none; }
.dscord-ui input.ds-checkbox:checked { border-color: var(--color-accent); background: var(--color-accent); }
.dscord-ui input.ds-checkbox:checked::after { content: ""; width: var(--space-2); height: var(--space-4); margin-top: calc(-1 * var(--space-1)); border: solid var(--color-text-on-accent); border-width: 0 var(--focus-width) var(--focus-width) 0; transform: rotate(45deg); }
.dscord-ui input.ds-radio:checked { border-color: var(--color-accent); }
.dscord-ui input.ds-radio:checked::after { content: ""; width: var(--space-4); height: var(--space-4); border-radius: var(--radius-round); background: var(--color-accent); }
.dscord-ui input:is(.ds-checkbox, .ds-radio):disabled { opacity: var(--opacity-disabled); cursor: default; }
`;
/** The page's own layout, on top of the design system. */
var styles = `${base}
.dscord-connect { width: 100%; height: 100%; min-height: 0; overflow: auto; background: var(--color-bg-primary); color: var(--color-text-primary); font-size: var(--font-size-body); line-height: var(--line-height-body); }
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
.dscord-connect :is(summary, a):focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--space-1); }

.dscord-connect .dc-notices { position: sticky; top: var(--space-4); z-index: 1; display: grid; gap: var(--space-4); }
.dscord-connect .dc-notice { padding: var(--space-5) var(--space-7); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: var(--color-bg-secondary); overflow-wrap: anywhere; }
.dscord-connect .dc-notice[data-tone="success"] { border-color: color-mix(in srgb, var(--color-status-success) 45%, transparent); background: color-mix(in srgb, var(--color-status-success) 10%, var(--color-bg-primary)); }
.dscord-connect .dc-notice[data-tone="error"] { border-color: color-mix(in srgb, var(--color-status-danger) 45%, transparent); background: color-mix(in srgb, var(--color-status-danger) 8%, var(--color-bg-primary)); color: var(--color-text-danger); }

.dscord-connect .dc-notice[data-tone="warning"] { border-color: color-mix(in srgb, var(--color-status-warning) 45%, transparent); background: color-mix(in srgb, var(--color-status-warning) 10%, var(--color-bg-primary)); }

.dscord-connect .dc-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.dscord-connect .dc-step { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-5) var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xl); color: var(--color-text-muted); line-height: var(--line-height-compact); }
.dscord-connect .dc-step-mark { display: grid; place-items: center; flex: 0 0 auto; width: var(--space-11); height: var(--space-11); border: 1px solid currentColor; border-radius: var(--radius-round); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); }
.dscord-connect .dc-step-copy { display: grid; gap: var(--space-1); min-width: 0; }
.dscord-connect .dc-step strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-step small { font-size: var(--font-size-sm); }
.dscord-connect .dc-step[data-state="current"] { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 6%, transparent); color: var(--color-text-primary); }
.dscord-connect .dc-step[data-state="current"] .dc-step-mark { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-connect .dc-step[data-state="done"] .dc-step-mark { border-color: var(--color-status-success); color: var(--color-status-success); }

.dscord-connect .dc-panel { display: grid; gap: var(--space-8); padding: var(--space-10) var(--space-12); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-xl); background: var(--color-bg-secondary); }
.dscord-connect .dc-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2) var(--space-8); }
.dscord-connect .dc-decision:is([data-state="missing"], [data-state="disabled"]) { border-color: color-mix(in srgb, var(--color-status-warning) 55%, transparent); }
.dscord-connect .dc-decision[data-state="failed"] { border-color: color-mix(in srgb, var(--color-status-danger) 55%, transparent); }
.dscord-connect .dc-points { display: grid; gap: var(--space-3); padding-left: var(--space-9); list-style: disc; }
.dscord-connect .dc-how { display: grid; gap: var(--space-3); counter-reset: dc-how; color: var(--color-text-muted); }
.dscord-connect .dc-how li { display: flex; gap: var(--space-4); counter-increment: dc-how; }
.dscord-connect .dc-how li::before { content: counter(dc-how) "."; flex: 0 0 auto; font-variant-numeric: tabular-nums; }

.dscord-connect .dc-form { display: grid; gap: var(--space-6); }
.dscord-connect .dc-field { display: grid; gap: var(--space-3); min-width: 0; font-size: var(--font-size-compact); font-weight: var(--font-weight-medium); }
.dscord-connect .dc-hint { color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: 400; }
.dscord-connect .dc-field .ds-input { font-weight: 400; }
.dscord-connect .dc-key { font-family: var(--font-family-code); word-break: break-all; }
.dscord-connect .dc-check { display: flex; align-items: center; gap: var(--space-4); cursor: pointer; }

.dscord-connect .dc-options { display: grid; gap: var(--space-1); }
.dscord-connect .dc-options legend { margin-bottom: var(--space-3); font-size: var(--font-size-compact); font-weight: var(--font-weight-medium); }
.dscord-connect .dc-option { display: flex; align-items: flex-start; gap: var(--space-5); padding: var(--space-4) var(--space-5); border-radius: var(--radius-lg); cursor: pointer; line-height: var(--line-height-compact); }
.dscord-connect .dc-option:hover { background: var(--color-bg-hover); }
.dscord-connect .dc-option:has(input:checked) { background: color-mix(in srgb, var(--color-accent) 9%, transparent); }
.dscord-connect .dc-option input { margin: var(--space-1) 0 0; }
.dscord-connect .dc-option strong, .dscord-connect .dc-option small { display: block; }
.dscord-connect .dc-option strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-option small { margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-sm); }

.dscord-connect .dc-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-4) var(--space-8); padding: var(--space-6) 0; border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-row:first-child { border-top: 0; padding-top: 0; }
.dscord-connect .dc-row:last-child { padding-bottom: 0; }
.dscord-connect .dc-copy { display: grid; gap: var(--space-1); flex: 1 1 220px; min-width: 0; }
.dscord-connect .dc-title { font-weight: var(--font-weight-semibold); overflow-wrap: anywhere; }

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
.dscord-connect .dc-status[data-status="warning"] { color: var(--color-status-warning); }

.dscord-connect .dc-disclosure > summary { display: flex; align-items: center; gap: var(--space-4); width: fit-content; cursor: pointer; font-weight: var(--font-weight-medium); list-style: none; }
.dscord-connect .dc-disclosure > summary::-webkit-details-marker { display: none; }
.dscord-connect .dc-disclosure > summary::before { content: ""; flex: 0 0 auto; width: var(--space-3); height: var(--space-3); border-right: var(--focus-width) solid currentColor; border-bottom: var(--focus-width) solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-fast); }
.dscord-connect .dc-disclosure[open] > summary::before { transform: rotate(45deg); }
.dscord-connect .dc-disclosure[open] > summary { margin-bottom: var(--space-6); }
.dscord-connect .dc-disclosure > .dc-body { display: grid; gap: var(--space-6); }
.dscord-connect .dc-divided { padding-top: var(--space-8); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect code { display: block; font-family: var(--font-family-code); font-size: var(--font-size-compact); overflow-wrap: anywhere; user-select: text; }

@media (max-width: 640px) {
  .dscord-connect .dc-content { padding: var(--space-9) var(--space-7) var(--space-12); }
  .dscord-connect .dc-panel { padding: var(--space-8); }
  .dscord-connect .dc-bot { padding: var(--space-6); }
  .dscord-connect .dc-steps { grid-template-columns: minmax(0, 1fr); }
  .dscord-connect .dc-account { text-align: left; }
}
`;
// dsh-connect/client/components/bots.tsx
var STATUS_KEYS = {
	offline: "statusOffline",
	connecting: "statusConnecting",
	online: "statusOnline",
	error: "statusError"
};
/** An address a browser can open safely, or nothing. */
function webLink(address) {
	try {
		const url = new URL(address || "");
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}
/** One Bot this device runs: the model it is on and how it is doing on each chat server. Nothing here is editable. */
function BotCard({ bot, t }) {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-bot",
		"aria-label": bot.name,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-identity",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-avatar",
					"aria-hidden": true,
					children: Array.from(bot.name)[0]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-copy",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-title",
							children: bot.name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: bot.globalId || bot.username
						}),
						bot.model && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-meta",
							children: `${t("model")} · ${bot.model}`
						})
					]
				})]
			}),
			bot.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error dc-small",
				children: bot.error
			}),
			bot.servers.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-links",
				children: bot.servers.map((server) => {
					const chat = server.status === "online" && webLink(server.url);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "dc-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-copy",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-title",
									children: server.serverName
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-status",
									"data-status": server.status,
									children: t(STATUS_KEYS[server.status] || "statusOffline")
								}),
								server.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-error dc-small",
									children: server.error
								})
							]
						}), chat && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dc-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: chat,
								target: "_blank",
								rel: "noopener noreferrer",
								children: t("openChat")
							})
						})]
					}, server.url);
				})
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-meta",
				children: t("notJoined")
			})
		]
	});
}
/** The Bots the owner's account runs on this device. They are set up on the web; this page only shows them. */
function BotsPanel({ value, t }) {
	const web = webLink(value.webUrl);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("deviceBots"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-heading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("deviceBots") }), web && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
					href: web,
					target: "_blank",
					rel: "noopener noreferrer",
					children: t("openWeb")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("deviceBotsHelp")
			}),
			value.bots.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-bots",
				children: value.bots.map((bot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BotCard, {
					bot,
					t
				}, bot.id))
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("emptyBots")
			})
		]
	});
}
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
* Links this DSH with a connection key from the DSCord web page. Pasting a whole key links at once, and the key
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
					children: [t("connectionKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Textarea, {
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
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "submit",
					disabled: busy,
					children: t(state.busy?.action === "login" ? "loggingIn" : "login")
				})
			})
		]
	});
}
// dsh-connect/client/components/kernel.tsx
var message = (reason) => reason.message;
/** Where the decision model stands, in the order the owner would fix it: a key, the switch, then a working answer. */
function decisionState(provider) {
	if (!provider?.configured) return "missing";
	if (provider.enabled === false) return "disabled";
	if (provider.available === false) return "failed";
	return provider.available ? "ready" : "unchecked";
}
/** Whether Bots on this device can rely on the decision model. A model that was never asked counts until it fails. */
var decisionWorks = (provider) => ["ready", "unchecked"].includes(decisionState(provider));
var STATE_TEXT = {
	missing: "decisionMissing",
	disabled: "decisionDisabled",
	failed: "decisionFailed",
	unchecked: "decisionUnchecked",
	ready: "decisionReady"
};
var SAVED_TEXT = {
	missing: "decisionSavedNoKey",
	disabled: "decisionSavedDisabled",
	failed: "decisionSavedFailed",
	unchecked: "decisionSaved",
	ready: "decisionSaved"
};
var STATE_TONE = {
	missing: "warning",
	disabled: "warning",
	failed: "error",
	unchecked: "online",
	ready: "online"
};
var ERRORS = [
	[/^ATTENTION_HTTP_40[13]$/, "decisionErrorKey"],
	[/^ATTENTION_HTTP_404$/, "decisionErrorAddress"],
	[/^ATTENTION_HTTP_429$/, "decisionErrorLimit"],
	[/^ATTENTION_(INVALID_RESPONSE|REFUSAL|SERVICE_ERROR)$/, "decisionErrorProtocol"],
	[/^ATTENTION_(TIMEOUT|PROVIDER_ERROR)$/, "decisionErrorUnreachable"]
];
var cloudflareEndpoint = (accountId, model) => /^[a-fA-F0-9]{32}$/.test(accountId) ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/${model}` : "";
/**
* The model that decides when Bots speak. Bots lose most of their conversational sense without it, so it has
* its own panel: what it does, what is missing, and a form that checks the settings as it saves them.
*/
function DecisionPanel({ connection, status, t }) {
	const [form, setForm] = (0, react.useState)(null);
	const [busy, setBusy] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)(null);
	const [saved, setSaved] = (0, react.useState)(null);
	const [round, setRound] = (0, react.useState)(0);
	const [enabled, setEnabled] = (0, react.useState)(status?.enabled !== false);
	const [preset, setPreset] = (0, react.useState)("openai-decisions");
	const [model, setModel] = (0, react.useState)("");
	const [endpoint, setEndpoint] = (0, react.useState)("");
	const [accountId, setAccountId] = (0, react.useState)("");
	const [hasKey, setHasKey] = (0, react.useState)(false);
	function selectPreset(selected) {
		setPreset(selected.id);
		setModel(selected.model);
		setEndpoint(selected.endpoint);
		setAccountId(selected.accountId ?? "");
		setHasKey(selected.hasKey);
		setSaved(null);
		setError(null);
	}
	function readForm(value) {
		setForm(value);
		if (value) {
			setEnabled(value.enabled);
			selectPreset(value.presets.find((item) => item.id === value.preset) ?? {
				...value,
				id: value.preset,
				name: "OpenAI Decisions",
				models: []
			});
		}
	}
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		connection.kernel("kernel-state", {}, controller).then((value) => {
			if (!controller.signal.aborted) readForm(value.decisionForm);
		}).catch((reason) => {
			if (!controller.signal.aborted) setError(message(reason));
		});
		return () => controller.abort();
	}, [connection]);
	const state = decisionState(status);
	const working = decisionWorks(status);
	const selected = form?.presets.find((item) => item.id === preset);
	const cloudflare = preset === "cloudflare-clef";
	function changeModel(value) {
		if (cloudflare && endpoint === cloudflareEndpoint(accountId, model)) setEndpoint(cloudflareEndpoint(accountId, value));
		setModel(value);
	}
	function changeAccount(value) {
		if (endpoint === cloudflareEndpoint(accountId, model)) setEndpoint(cloudflareEndpoint(value, model));
		setAccountId(value);
	}
	const tooLong = /max_tokens|context.length|too long/i.test(status?.errorDetail ?? "");
	const reason = status?.error ? t(tooLong ? "decisionErrorTooLong" : ERRORS.find(([pattern]) => pattern.test(status.error))?.[1] ?? "decisionErrorOther", { code: status.error }) : null;
	async function submit(event) {
		event.preventDefault();
		const fields = event.currentTarget.elements;
		const field = (name) => fields.namedItem(name);
		const apiKey = field("decisionApiKey").value.trim();
		setBusy(true);
		setError(null);
		setSaved(null);
		try {
			const next = await connection.kernel("save-decision-provider", {
				enabled,
				preset,
				...apiKey ? { apiKey } : {},
				...model === (selected?.model ?? "") ? {} : { model: model.trim() },
				...endpoint === (selected?.endpoint ?? "") ? {} : { endpoint: endpoint.trim() },
				...cloudflare && accountId !== (selected?.accountId ?? "") ? { accountId: accountId.trim() } : {}
			});
			const kernel = await connection.kernel("kernel-state");
			await connection.refresh({ clearError: false });
			readForm(kernel.decisionForm);
			setSaved(decisionState(next));
			setRound((value) => value + 1);
		} catch (reason) {
			setError(message(reason));
		} finally {
			setBusy(false);
		}
	}
	const settings = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
		className: "dc-form",
		onSubmit: (event) => void submit(event),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						htmlFor: "decision-preset",
						children: t("decisionService")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Select, {
						id: "decision-preset",
						name: "decisionPreset",
						value: preset,
						disabled: busy || !form,
						onChange: (event) => {
							const next = form?.presets.find((item) => item.id === event.target.value);
							if (next) selectPreset(next);
						},
						children: (form?.presets ?? []).map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: item.id,
							children: item.name
						}, item.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dc-hint",
						children: t("decisionServiceHelp")
					})
				]
			}),
			cloudflare && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("decisionAccount"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
						name: "decisionAccount",
						value: accountId,
						onChange: (event) => changeAccount(event.target.value.trim()),
						required: enabled && !endpoint,
						disabled: busy,
						spellCheck: false,
						autoCapitalize: "none"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-hint",
					children: t("decisionAccountHelp")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("decisionApiKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
						name: "decisionApiKey",
						type: "password",
						autoComplete: "new-password",
						required: enabled && !hasKey,
						disabled: busy,
						spellCheck: false,
						autoCapitalize: "none"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-hint",
					children: t(hasKey ? "decisionKeyHelp" : "decisionKeyNeeded")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
						htmlFor: "decision-model",
						children: t("decisionModelName")
					}),
					cloudflare ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Select, {
						id: "decision-model",
						name: "decisionModel",
						value: model,
						onChange: (event) => changeModel(event.target.value),
						disabled: busy,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "clef",
							children: "Clef"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "clef-flash",
							children: "Clef Flash"
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
						id: "decision-model",
						name: "decisionModel",
						value: model,
						onChange: (event) => changeModel(event.target.value),
						list: "decision-models",
						disabled: busy,
						spellCheck: false,
						autoCapitalize: "none"
					}),
					!cloudflare && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
						id: "decision-models",
						children: selected?.models.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value }, value))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dc-hint",
						children: t("decisionModelHelp")
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-field",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("decisionEndpoint"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Input, {
						name: "decisionEndpoint",
						value: endpoint,
						onChange: (event) => setEndpoint(event.target.value),
						disabled: busy,
						spellCheck: false,
						autoCapitalize: "none"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-hint",
					children: t("decisionEndpointHelp")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dc-check",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Checkbox, {
					name: "enabled",
					checked: enabled,
					onChange: (event) => setEnabled(event.target.checked),
					disabled: busy
				}), t("enableDecision")]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dc-actions",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
					type: "submit",
					variant: working ? "secondary" : "default",
					disabled: busy,
					children: t(busy ? "decisionSaving" : "saveDecision")
				})
			})
		]
	}, `${preset}\n${round}`);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel dc-decision",
		"aria-label": t("decisionTitle"),
		"data-state": state,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-heading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("decisionTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-status",
					"data-status": STATE_TONE[state],
					children: [t(STATE_TEXT[state]), working && status?.model].filter(Boolean).join(" · ")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-meta",
				children: t("decisionHelp")
			}),
			!working && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
				className: "dc-points",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("decisionDoesJoin") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("decisionDoesTurns") })]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-notice",
				"data-tone": "warning",
				children: t("decisionWithout")
			})] }),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error dc-small",
				children: error
			}),
			saved && SAVED_TEXT[saved] === SAVED_TEXT[state] && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: saved === "ready" || saved === "unchecked" ? "dc-meta" : "dc-error dc-small",
				children: t(SAVED_TEXT[saved])
			}),
			state === "failed" && reason && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
				role: "alert",
				className: "dc-error dc-small",
				children: [reason, status?.errorDetail && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("br", {}), t("decisionErrorDetail", { detail: status.errorDetail })] })]
			}),
			working ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dc-disclosure",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("decisionEdit") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dc-body",
					children: settings
				})]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state === "missing" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ol", {
				className: "dc-how",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("decisionSetup1") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("decisionSetup2") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("decisionSetup3") })
				]
			}), settings] })
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
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
						variant: "secondary",
						type: "button",
						disabled: busy || installing,
						onClick: () => void run("kernel-update-check"),
						children: t("updateCheck")
					}), view.available && view.source === "registry" && view.phase !== "installed" && view.phase !== "restart-required" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
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
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Radio, {
							name: "kernelUpdatePolicy",
							value: policy,
							checked: view.policy === policy,
							onChange: () => void run("kernel-update-policy", { policy })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(key) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(`${key}Help`) })] })]
					}, policy)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Checkbox, {
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
// dsh-connect/client/components/page.tsx
var STEPS = [
	["stepAccount", "stepAccountHint"],
	["stepDecision", "stepDecisionHint"],
	["stepBot", "stepBotHint"],
	["stepOnline", "stepOnlineHint"]
];
/**
* The steps from a fresh install to a Bot that answers the way it is meant to, shown until all are done.
* The decision model is one of them: a Bot can go online without it, but it is not complete.
*/
function SetupGuide({ value, t }) {
	const done = [
		Boolean(value.user),
		decisionWorks(value.decision),
		value.bots.length > 0,
		value.bots.some((bot) => bot.servers.some((server) => server.status === "online"))
	];
	if (done.every(Boolean)) return null;
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
/** What the last action said, and anything wrong with the link; it stays in view while the page scrolls. */
function Notices({ state, value, t }) {
	const errorMessage = state.errorTranslation ? t(state.errorTranslation.key, state.errorTranslation.params) : state.error;
	const unreachable = value?.user && value.lastError ? value.lastError : null;
	const runtimeDown = value?.runtime?.available === false;
	if (!state.notice && !errorMessage && !unreachable && !runtimeDown) return null;
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
			unreachable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-notice",
				"data-tone": "error",
				children: t("centralUnreachable", { error: unreachable })
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
/**
* DSCord's page in DSH. It links this DSH to the owner's account, holds the decision model this device's Bots
* share, and shows the Bots that account runs here; Bots themselves are set up on the DSCord web page.
*/
function ConnectionPage({ connection, t }) {
	const state = (0, react.useSyncExternalStore)(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
	const value = state.value;
	const user = value?.user;
	const busy = state.loading || Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dscord-ui dscord-connect",
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
									children: [user.globalId || user.id, value?.label].filter(Boolean).join(" · ")
								})]
							}),
							user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "secondary",
								type: "button",
								disabled: Boolean(state.busy),
								onClick: () => void connection.logout(),
								children: t(state.busy?.action === "logout" ? "loggingOut" : "logout")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
								variant: "secondary",
								type: "button",
								disabled: busy,
								onClick: () => void (user ? connection.sync() : connection.refresh()),
								children: t(state.busy?.action === "sync" ? "refreshing" : "refresh")
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
				value && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SetupGuide, {
					value,
					t
				}),
				!state.loading && !user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoginForm, {
					connection,
					state,
					t
				}),
				value && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DecisionPanel, {
					connection,
					status: value.decision,
					t
				}),
				value && user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BotsPanel, {
					value,
					t
				}),
				value?.kernelUpdates && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KernelUpdatePanel, {
					connection,
					initial: value.kernelUpdates,
					t
				}),
				value?.dataDirectory && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dc-panel",
					"aria-label": t("advanced"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("advanced") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfigDirectory, {
						directory: value.dataDirectory,
						t
					})]
				})
			]
		})]
	});
}
// dsh-connect/client/connection.ts
var SHORT_ACTIONS = [
	"status",
	"login",
	"kernel-state"
];
/** What the page says after an action whose result is not otherwise in view. */
var NOTICES = { login: "linked" };
var ERROR_KEYS = {
	DSCORD_KERNEL_CONFLICT: "kernelConflict",
	CONNECT_KEY_INVALID: "connectKeyInvalid",
	CONNECT_CODE_UNKNOWN: "connectKeyUnknown",
	CONNECT_CODE_EXPIRED: "connectKeyExpired",
	INVALID_DECISION_ENDPOINT: "decisionEndpointInvalid",
	INVALID_DECISION_MODEL: "decisionModelInvalid",
	INVALID_DECISION_PRESET: "decisionPresetInvalid",
	INVALID_DECISION_ACCOUNT: "decisionAccountInvalid"
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
			busy: { action },
			notice: null,
			error: null,
			errorTranslation: null
		});
		try {
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
	return {
		getSnapshot: () => snapshot,
		subscribe,
		refresh,
		login: (key) => mutate("login", { key }),
		logout: () => mutate("logout"),
		/** Report to the central server now, instead of waiting for the next round. */
		sync: () => mutate("sync"),
		kernel: (action, payload = {}, controller = new AbortController()) => request(action, payload, controller, false),
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
	unknown: "未知",
	decisionTitle: "决策模型",
	decisionService: "服务预设",
	decisionServiceHelp: "选择服务后自动填写默认模型和地址。每个服务分别保存凭据。",
	decisionAccount: "Cloudflare 账户 ID",
	decisionAccountHelp: "在 Cloudflare 的 Workers AI 页面复制账户 ID，服务地址会自动生成。",
	decisionHelp: "Bot 靠它判断什么时候该开口。它和 Bot 回答用的模型是两回事，只保存在这台设备上，这台设备运行的 Bot 共用。",
	decisionDoesJoin: "设为「自然参与」的 Bot 没被 @ 时，靠它判断该接话、等一等，还是继续听。",
	decisionDoesTurns: "对方连发几条消息时，靠它判断是等对方说完、并进正在写的回答，还是分开回答。",
	decisionWithout: "没有它，Bot 只在被 @ 或私聊时回答，「自然参与」不起作用；连发的消息只能按固定时间等一下再答，分不清你有没有说完。",
	decisionMissing: "未配置",
	decisionDisabled: "已停用",
	decisionFailed: "请求失败",
	decisionUnchecked: "已配置，尚未验证",
	decisionReady: "运行正常",
	decisionSetup1: "选择服务，准备它的 API key；Cloudflare 使用 Workers AI API token。",
	decisionSetup2: "填写凭据。默认模型和地址已填好，Cloudflare 还需要账户 ID。",
	decisionSetup3: "点「保存并验证」，用两个合成小问题检查参与判断与接话接口，会产生模型请求。",
	decisionApiKey: "决策模型 API key",
	decisionKeyNeeded: "必填。只保存在这台设备，保存后不会再显示。",
	decisionKeyHelp: "这个服务已有凭据，不会再显示。留空保留，填写则替换。",
	decisionModelName: "决策模型名",
	decisionModelHelp: "决策服务里的模型名。清空后恢复默认。",
	decisionEndpoint: "服务地址",
	decisionEndpointHelp: "所选服务的完整接口地址。清空后恢复默认，Cloudflare 根据账户生成。",
	enableDecision: "启用决策模型",
	saveDecision: "保存并验证",
	decisionSaving: "正在验证…",
	decisionEdit: "修改设置",
	decisionSaved: "已保存，决策模型可以用了。",
	decisionSavedNoKey: "已保存，但还没有 API key，决策模型还不能用。",
	decisionSavedDisabled: "已保存。决策模型现在是停用的。",
	decisionSavedFailed: "已保存，但验证没有通过。",
	decisionErrorKey: "服务拒绝了这把 key（{code}）。检查 key 有没有填对、能不能用这个模型。",
	decisionErrorAddress: "服务地址不对，或服务里没有这个模型（{code}）。",
	decisionErrorLimit: "服务说请求太多或额度用完了（{code}）。稍后再点一次「保存并验证」。",
	decisionErrorProtocol: "服务有回应，但格式或模型与所选服务不符（{code}）。检查服务预设、地址和模型名。",
	decisionErrorUnreachable: "连不上服务或等待超时（{code}）。检查网络和服务地址。",
	decisionErrorOther: "服务没有正常回答（{code}）。",
	decisionErrorTooLong: "这次要判断的群聊内容超出了模型一次能读的长度（{code}）。",
	decisionErrorDetail: "服务返回：{detail}",
	decisionEndpointInvalid: "服务地址要以 http:// 或 https:// 开头，不能带账号密码或 # 片段。",
	decisionModelInvalid: "模型名不能为空，也不能有空格。",
	decisionPresetInvalid: "请选择支持的决策服务。",
	decisionAccountInvalid: "Cloudflare 账户 ID 应为 32 位十六进制字符，也可以填写完整的 Workers AI 服务地址。",
	kernelConflict: "这台设备正在运行旧的 Bot 内核。请先停用旧插件，按迁移说明启用 DSCord。",
	model: "模型",
	title: "DSCord",
	pageLabel: "DSCord 连接",
	loginTitle: "连接 DSCord 账号",
	connectionKey: "连接密钥",
	login: "连接",
	loggingIn: "正在连接…",
	connectKeyInvalid: "连接密钥不完整，请从 DSCord 网页重新复制。",
	connectKeyUnknown: "连接密钥已用过或不存在，请在网页上重新生成。",
	connectKeyExpired: "连接密钥已过期，请在网页上重新生成。",
	statusOffline: "未上线",
	statusConnecting: "正在连接",
	statusOnline: "已上线",
	statusError: "连接失败",
	openWeb: "打开 DSCord 网页",
	refresh: "刷新",
	readStatus: "正在读取连接状态…",
	runtimeUnavailable: "Bot 运行环境暂不可用",
	account: "当前账号",
	logout: "退出登录",
	loggingOut: "正在退出…",
	emptyBots: "还没有 Bot。在 DSCord 网页点「添加 Bot」，它会自动出现在这里并上线。",
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
	updatePrerelease: "包含预发布版本",
	updateCheck: "检查更新",
	updateInstall: "安装 {version}",
	updateInstalling: "正在安装…",
	updateInstalled: "新版本已安装。",
	updateRestart: "新版本已安装，重启 DSH 后生效。",
	updateFailed: "安装失败：{error}",
	updateNotRegistry: "插件不是从 npm 安装的，请手动安装新版本。",
	notJoined: "还没有加入聊天服务器。在网页的「我的 Bot」里让它加入。",
	openChat: "去聊天",
	loginStep1: "在 DSCord 网页点「添加 Bot」，或打开「设置 → 账号 → 连接 DSH」。",
	loginStep2: "点「复制连接密钥」。",
	loginStep3: "回到这里粘贴，粘贴后自动连接。",
	keyPlaceholder: "在这里粘贴连接密钥",
	keyHint: "密钥 10 分钟内有效，只能用一次。",
	advanced: "更多设置",
	guideLabel: "开始使用",
	stepAccount: "连接账号",
	stepAccountHint: "粘贴网页上复制的连接密钥",
	stepDecision: "配置决策模型",
	stepDecisionHint: "在下面填 API key 并验证",
	stepBot: "添加 Bot",
	stepBotHint: "在 DSCord 网页点「添加 Bot」",
	stepOnline: "上线",
	stepOnlineHint: "Bot 自动上线，去聊天里 @ 它",
	stepDone: "已完成",
	deviceBots: "这台设备运行的 Bot",
	deviceBotsHelp: "Bot 的名字、职责、模型和加入哪些服务器，都在 DSCord 网页的「我的 Bot」里设置，这里几秒内自动跟上。",
	linked: "已连接。在网页上添加的 Bot 会自动出现在这里。",
	refreshing: "正在刷新…",
	centralUnreachable: "暂时连不上中央服务器，Bot 按上次的设置继续运行：{error}",
	policyAutoHelp: "Bot 空闲时自动安装兼容此服务器的最新版本。",
	policyNotifyHelp: "定期检查，由你决定何时安装。",
	policyManualHelp: "只在你点检查时查找新版本。"
};
var en = {
	unknown: "Unknown",
	decisionTitle: "Decision model",
	decisionService: "Service preset",
	decisionServiceHelp: "Choosing a service fills in its default model and address. Credentials are saved separately for each service.",
	decisionAccount: "Cloudflare Account ID",
	decisionAccountHelp: "Copy your Account ID from Workers AI in Cloudflare. The service address is filled in automatically.",
	decisionHelp: "Bots use it to judge when to speak. It is separate from the model a Bot answers with, is kept only on this device, and is shared by the Bots this device runs.",
	decisionDoesJoin: "A Bot set to “Join naturally” uses it, when nobody mentions the Bot, to decide whether to join in, wait, or keep listening.",
	decisionDoesTurns: "When someone sends several messages in a row, it decides whether to wait for the rest, fold them into the answer being written, or answer each one.",
	decisionWithout: "Without it, Bots answer only when mentioned or messaged directly and “Join naturally” does nothing; messages sent in a row are answered after a fixed pause, with no sense of whether you have finished.",
	decisionMissing: "Not set up",
	decisionDisabled: "Turned off",
	decisionFailed: "Request failed",
	decisionUnchecked: "Set up, not checked yet",
	decisionReady: "Working",
	decisionSetup1: "Choose a service and get its API key. Cloudflare uses a Workers AI API token.",
	decisionSetup2: "Enter the credential below. The default model and address are filled in; Cloudflare also needs an Account ID.",
	decisionSetup3: "Choose “Save and check”. Two small synthetic questions check participation and turn-taking. This sends model requests.",
	decisionApiKey: "Decision model API key",
	decisionKeyNeeded: "Required. Stored only on this device and never shown again.",
	decisionKeyHelp: "This service has a saved credential, which is never shown again. Leave this blank to keep it, or enter a replacement.",
	decisionModelName: "Decision model name",
	decisionModelHelp: "The model’s name at the decision service. Clear it to return to the default.",
	decisionEndpoint: "Service address",
	decisionEndpointHelp: "The full endpoint for the selected service. Clear it to use the default; Cloudflare builds it from your account.",
	enableDecision: "Use the decision model",
	saveDecision: "Save and check",
	decisionSaving: "Checking…",
	decisionEdit: "Change settings",
	decisionSaved: "Saved. The decision model is working.",
	decisionSavedNoKey: "Saved, but there is no API key yet, so the decision model cannot work.",
	decisionSavedDisabled: "Saved. The decision model is turned off.",
	decisionSavedFailed: "Saved, but the check did not pass.",
	decisionErrorKey: "The service refused this key ({code}). Check the key and that it may use this model.",
	decisionErrorAddress: "The address is wrong, or the service does not have this model ({code}).",
	decisionErrorLimit: "The service says there are too many requests or the quota is used up ({code}). Choose “Save and check” again later.",
	decisionErrorProtocol: "The service answered, but its format or model does not match the selected service ({code}). Check the preset, address, and model.",
	decisionErrorUnreachable: "The service could not be reached or took too long ({code}). Check the network and the address.",
	decisionErrorOther: "The service did not answer properly ({code}).",
	decisionErrorTooLong: "The conversation to judge was longer than the model can read at once ({code}).",
	decisionErrorDetail: "The service said: {detail}",
	decisionEndpointInvalid: "The address must start with http:// or https:// and carry no credentials or # fragment.",
	decisionModelInvalid: "The model name cannot be empty or contain spaces.",
	decisionPresetInvalid: "Choose a supported decision service.",
	decisionAccountInvalid: "Use a 32-character hexadecimal Cloudflare Account ID, or enter a complete Workers AI endpoint.",
	kernelConflict: "An older Bot kernel is running on this device. Stop its plugin and follow the migration instructions to enable DSCord.",
	model: "Model",
	title: "DSCord",
	pageLabel: "DSCord connection",
	loginTitle: "Connect your DSCord account",
	connectionKey: "Connection key",
	login: "Connect",
	loggingIn: "Connecting…",
	connectKeyInvalid: "This connection key is incomplete. Copy it again from the DSCord web page.",
	connectKeyUnknown: "This connection key was already used or does not exist. Make a new one on the web page.",
	connectKeyExpired: "This connection key has expired. Make a new one on the web page.",
	statusOffline: "Offline",
	statusConnecting: "Connecting",
	statusOnline: "Online",
	statusError: "Connection failed",
	openWeb: "Open DSCord on the web",
	refresh: "Refresh",
	readStatus: "Loading connection status…",
	runtimeUnavailable: "The Bot runtime is currently unavailable",
	account: "Current account",
	logout: "Sign out",
	loggingOut: "Signing out…",
	emptyBots: "No Bots yet. Choose “Add a Bot” on the DSCord web page and it appears here and goes online by itself.",
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
	updatePrerelease: "Include prereleases",
	updateCheck: "Check for updates",
	updateInstall: "Install {version}",
	updateInstalling: "Installing…",
	updateInstalled: "The new version is installed.",
	updateRestart: "The new version is installed. Restart DSH to use it.",
	updateFailed: "Install failed: {error}",
	updateNotRegistry: "This plugin was not installed from npm. Install the new version by hand.",
	notJoined: "Not on any chat server yet. Add it to one under “My Bots” on the web page.",
	openChat: "Open chat",
	loginStep1: "On the DSCord web page, choose “Add a Bot”, or open Settings → Account → Connect DSH.",
	loginStep2: "Choose “Copy connection key”.",
	loginStep3: "Paste it here. It connects as soon as you paste.",
	keyPlaceholder: "Paste the connection key here",
	keyHint: "A key works once, within 10 minutes.",
	advanced: "More settings",
	guideLabel: "Getting started",
	stepAccount: "Connect your account",
	stepAccountHint: "Paste the key copied from the web page",
	stepDecision: "Set up the decision model",
	stepDecisionHint: "Enter an API key below and check it",
	stepBot: "Add a Bot",
	stepBotHint: "Choose “Add a Bot” on the DSCord web page",
	stepOnline: "Go online",
	stepOnlineHint: "The Bot goes online by itself; mention it in a chat",
	stepDone: "Done",
	deviceBots: "Bots this device runs",
	deviceBotsHelp: "A Bot’s name, role, model and chat servers are set on the DSCord web page under “My Bots”. This device follows within seconds.",
	linked: "Connected. Bots you add on the web page appear here by themselves.",
	refreshing: "Refreshing…",
	centralUnreachable: "The central server cannot be reached right now. Bots keep running as last set up: {error}",
	policyAutoHelp: "Install the newest version that works with this server while Bots are idle.",
	policyNotifyHelp: "Check regularly and let you decide when to install.",
	policyManualHelp: "Look for new versions only when you check."
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
		return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dscord-ui",
			style: {
				position: "fixed",
				left: 56,
				bottom: 16,
				zIndex: 50,
				pointerEvents: "auto"
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: base }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Button, {
				variant: "secondary",
				type: "button",
				onClick: () => {
					face.actions.setSurface("agent");
					ctx.layout.selectPanel(panelId);
				},
				children: t("title")
			})]
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
