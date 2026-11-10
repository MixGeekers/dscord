import { design } from "./design";

// The design system as the page needs it: design.ts (the web pages' tokens and control rules) and the few
// declarations the web pages get from Tailwind utilities or Base UI and a plain element has to get here.
// Every colour, size of type, gap and radius comes from a token.
export const base = `${design}
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
export const styles = `${base}
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
