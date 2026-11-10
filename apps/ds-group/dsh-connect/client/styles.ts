import { tokens } from "./tokens";

// Every colour, size of type, gap and radius comes from tokens.ts, the same names the web pages use.
export const styles = `${tokens}
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
