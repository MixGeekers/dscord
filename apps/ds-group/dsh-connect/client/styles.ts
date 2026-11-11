import { design } from "./design";

// The design system as the page needs it: design.ts (the web pages' tokens and control rules) and the few
// declarations the web pages get from Tailwind utilities or Base UI and a plain element has to get here.
// Every colour, size of type, gap and radius comes from a token.
export const base = `${design}
.dscord-ui { font-family: var(--font-family-ui); font-synthesis: none; }
.dscord-ui, .dscord-ui *, .dscord-ui *::before, .dscord-ui *::after { box-sizing: border-box; }
.dscord-ui .ds-button { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; gap: var(--space-sm); margin: 0; font-family: inherit; white-space: nowrap; user-select: none; transition: background-color var(--motion-fast), color var(--motion-fast); }
.dscord-ui .ds-input { display: block; width: 100%; min-width: 0; margin: 0; outline: none; }
.dscord-ui input:is(.ds-checkbox, .ds-radio) { appearance: none; -webkit-appearance: none; }
.dscord-ui input.ds-checkbox:checked { border-color: var(--color-accent); background: var(--color-accent); }
.dscord-ui input.ds-checkbox:checked::after { content: ""; width: var(--space-xs); height: var(--space-sm); margin-top: calc(-1 * var(--space-2xs)); border: solid var(--color-text-on-accent); border-width: 0 var(--focus-width) var(--focus-width) 0; transform: rotate(45deg); }
.dscord-ui input.ds-radio:checked { border-color: var(--color-accent); }
.dscord-ui input.ds-radio:checked::after { content: ""; width: var(--space-sm); height: var(--space-sm); border-radius: var(--radius-round); background: var(--color-accent); }
.dscord-ui .dc-select { position: relative; display: block; min-width: 0; }
.dscord-ui .dc-select .ds-select-popup { position: absolute; top: calc(100% + var(--space-xs)); right: 0; left: 0; z-index: var(--z-ui-popover); min-width: 0; max-height: calc(var(--size-control) * 8); }
.dscord-ui .dc-select .ds-select-popup[hidden] { display: none; }
.dscord-ui input:is(.ds-checkbox, .ds-radio):disabled { opacity: var(--opacity-disabled); cursor: default; }
`;

/** The page's own layout, on top of the design system. */
export const styles = `${base}
.dscord-connect { font: var(--text-body); width: 100%; height: 100%; min-height: 0; overflow: auto; background: var(--color-bg-primary); color: var(--color-text-primary); line-height: var(--line-height-body); }
.dscord-connect :is(h1, h2, h3, p, ul, ol, fieldset, legend) { margin: 0; padding: 0; }
.dscord-connect :is(ul, ol) { list-style: none; }
.dscord-connect fieldset { border: 0; min-width: 0; }
.dscord-connect .dc-content { display: grid; gap: var(--space-lg); width: min(100%, 780px); margin: 0 auto; padding: var(--space-3xl) var(--space-2xl) var(--space-3xl); }
.dscord-connect .dc-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-sm) var(--space-lg); }
.dscord-connect h1 { font: var(--text-title); line-height: var(--line-height-compact); }
.dscord-connect h2 { font: var(--text-heading); line-height: var(--line-height-compact); }
.dscord-connect h3 { font: var(--text-body-strong); font-weight: var(--font-weight-semibold); line-height: var(--line-height-compact); }
.dscord-connect .dc-toolbar, .dscord-connect .dc-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); }
.dscord-connect .dc-account { min-width: 0; text-align: right; line-height: var(--line-height-compact); }
.dscord-connect .dc-account-name { font-weight: var(--font-weight-medium); overflow-wrap: anywhere; }
.dscord-connect .dc-muted { color: var(--color-text-muted); }
.dscord-connect .dc-small, .dscord-connect .dc-meta { font: var(--text-body); }
.dscord-connect .dc-meta { color: var(--color-text-muted); overflow-wrap: anywhere; }
.dscord-connect .dc-error { color: var(--color-text-danger); overflow-wrap: anywhere; }
.dscord-connect a { color: var(--color-link); text-decoration: none; white-space: nowrap; }
.dscord-connect a:hover { text-decoration: underline; }
.dscord-connect :is(summary, a):focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--focus-offset); }

.dscord-connect .dc-notices { position: sticky; top: var(--space-sm); z-index: 1; display: grid; gap: var(--space-sm); }
.dscord-connect .dc-notice { padding: var(--space-md) var(--space-lg); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-bg-secondary); overflow-wrap: anywhere; }
.dscord-connect .dc-notice[data-tone="success"] { border-color: color-mix(in srgb, var(--color-status-success) 45%, transparent); background: color-mix(in srgb, var(--color-status-success) 10%, var(--color-bg-primary)); }
.dscord-connect .dc-notice[data-tone="error"] { border-color: color-mix(in srgb, var(--color-status-danger) 45%, transparent); background: color-mix(in srgb, var(--color-status-danger) 8%, var(--color-bg-primary)); color: var(--color-text-danger); }

.dscord-connect .dc-notice[data-tone="warning"] { border-color: color-mix(in srgb, var(--color-status-warning) 45%, transparent); background: color-mix(in srgb, var(--color-status-warning) 10%, var(--color-bg-primary)); }

.dscord-connect .dc-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-sm); }
.dscord-connect .dc-step { display: flex; align-items: flex-start; gap: var(--space-sm); padding: var(--space-md) var(--space-md); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); color: var(--color-text-muted); line-height: var(--line-height-compact); }
.dscord-connect .dc-step-mark { font: var(--text-label); display: grid; place-items: center; flex: 0 0 auto; width: var(--space-2xl); height: var(--space-2xl); border: 1px solid currentColor; border-radius: var(--radius-round); }
.dscord-connect .dc-step-copy { display: grid; gap: var(--space-2xs); min-width: 0; }
.dscord-connect .dc-step strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-step small { font: var(--text-caption); }
.dscord-connect .dc-step[data-state="current"] { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 6%, transparent); color: var(--color-text-primary); }
.dscord-connect .dc-step[data-state="current"] .dc-step-mark { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-connect .dc-step[data-state="done"] .dc-step-mark { border-color: var(--color-status-success); color: var(--color-status-success); }

.dscord-connect .dc-panel { display: grid; gap: var(--space-lg); padding: var(--space-xl) var(--space-2xl); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: var(--color-bg-secondary); }
.dscord-connect .dc-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-xs) var(--space-lg); }
.dscord-connect .dc-decision:is([data-state="missing"], [data-state="disabled"]) { border-color: color-mix(in srgb, var(--color-status-warning) 55%, transparent); }
.dscord-connect .dc-decision[data-state="failed"] { border-color: color-mix(in srgb, var(--color-status-danger) 55%, transparent); }
.dscord-connect .dc-points { display: grid; gap: var(--space-sm); padding-left: var(--space-lg); list-style: disc; }
.dscord-connect .dc-how { display: grid; gap: var(--space-sm); counter-reset: dc-how; color: var(--color-text-muted); }
.dscord-connect .dc-how li { display: flex; gap: var(--space-sm); counter-increment: dc-how; }
.dscord-connect .dc-how li::before { content: counter(dc-how) "."; flex: 0 0 auto; font-variant-numeric: tabular-nums; }

.dscord-connect .dc-form { display: grid; gap: var(--space-md); }
.dscord-connect .dc-field { font: var(--text-body-strong); display: grid; gap: var(--space-sm); min-width: 0; }
.dscord-connect .dc-hint { font: var(--text-caption); color: var(--color-text-muted); font-weight: var(--font-weight-regular); }
.dscord-connect .dc-field .ds-input { font-weight: var(--font-weight-regular); }
.dscord-connect .dc-key { font-family: var(--font-family-code); word-break: break-all; }
.dscord-connect .dc-check { display: flex; align-items: center; gap: var(--space-sm); cursor: pointer; }

.dscord-connect .dc-options { display: grid; gap: var(--space-2xs); }
.dscord-connect .dc-options legend { font: var(--text-body-strong); margin-bottom: var(--space-sm); }
.dscord-connect .dc-option { display: flex; align-items: flex-start; gap: var(--space-md); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); cursor: pointer; line-height: var(--line-height-compact); }
.dscord-connect .dc-option:hover { background: var(--color-bg-hover); }
.dscord-connect .dc-option:has(input:checked) { background: color-mix(in srgb, var(--color-accent) 9%, transparent); }
.dscord-connect .dc-option input { margin: var(--space-2xs) 0 0; }
.dscord-connect .dc-option strong, .dscord-connect .dc-option small { display: block; }
.dscord-connect .dc-option strong { font-weight: var(--font-weight-medium); }
.dscord-connect .dc-option small { font: var(--text-caption); margin-top: var(--space-2xs); color: var(--color-text-muted); }

.dscord-connect .dc-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-sm) var(--space-lg); padding: var(--space-md) 0; border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-row:first-child { border-top: 0; padding-top: 0; }
.dscord-connect .dc-row:last-child { padding-bottom: 0; }
.dscord-connect .dc-copy { display: grid; gap: var(--space-2xs); flex: 1 1 220px; min-width: 0; }
.dscord-connect .dc-title { font-weight: var(--font-weight-semibold); overflow-wrap: anywhere; }

.dscord-connect .dc-bots { display: grid; gap: var(--space-md); }
.dscord-connect .dc-bot { display: grid; gap: var(--space-md); padding: var(--space-lg); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: var(--color-bg-primary); }
.dscord-connect .dc-identity { display: flex; align-items: center; gap: var(--space-md); min-width: 0; flex: 1 1 220px; }
.dscord-connect .dc-avatar { font: var(--text-title); display: grid; place-items: center; flex: 0 0 auto; width: var(--size-avatar-message); height: var(--size-avatar-message); border-radius: var(--radius-lg); background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); }
.dscord-connect .dc-links { display: grid; padding-top: var(--space-md); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect .dc-status { font: var(--text-body); display: inline-flex; align-items: center; gap: var(--space-sm); color: var(--color-text-muted); white-space: nowrap; }
.dscord-connect .dc-status::before { content: ""; flex: 0 0 auto; width: var(--space-sm); height: var(--space-sm); border-radius: var(--radius-round); background: currentColor; }
.dscord-connect .dc-status[data-status="online"] { color: var(--color-status-success); }
.dscord-connect .dc-status[data-status="error"] { color: var(--color-status-danger); }
.dscord-connect .dc-status[data-status="connecting"] { color: var(--color-accent); }
.dscord-connect .dc-status[data-status="warning"] { color: var(--color-status-warning); }

.dscord-connect .dc-disclosure > summary { display: flex; align-items: center; gap: var(--space-sm); width: fit-content; cursor: pointer; font-weight: var(--font-weight-medium); list-style: none; }
.dscord-connect .dc-disclosure > summary::-webkit-details-marker { display: none; }
.dscord-connect .dc-disclosure > summary::before { content: ""; flex: 0 0 auto; width: var(--space-sm); height: var(--space-sm); border-right: var(--focus-width) solid currentColor; border-bottom: var(--focus-width) solid currentColor; transform: rotate(-45deg); transition: transform var(--motion-fast); }
.dscord-connect .dc-disclosure[open] > summary::before { transform: rotate(45deg); }
.dscord-connect .dc-disclosure[open] > summary { margin-bottom: var(--space-md); }
.dscord-connect .dc-disclosure > .dc-body { display: grid; gap: var(--space-md); }
.dscord-connect .dc-divided { padding-top: var(--space-lg); border-top: 1px solid var(--color-border-subtle); }
.dscord-connect code { font: var(--text-code); display: block; font-family: var(--font-family-code); overflow-wrap: anywhere; user-select: text; }

@media (max-width: 640px) {
  .dscord-connect .dc-content { padding: var(--space-lg) var(--space-lg) var(--space-2xl); }
  .dscord-connect .dc-panel { padding: var(--space-lg); }
  .dscord-connect .dc-bot { padding: var(--space-md); }
  .dscord-connect .dc-steps { grid-template-columns: minmax(0, 1fr); }
  .dscord-connect .dc-account { text-align: left; }
}
`;
