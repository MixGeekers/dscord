// Generated from web/tokens.css and ui/styles.css by `npm run build:dsh-client` (scripts/panel-design.mjs). Do not edit by hand.
/** DSCord's design system for the page inside DSH: the web pages' tokens and control styles, kept under one class. */
export const design = `
.dscord-ui {
  color-scheme: light;
  --font-family-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-family-code: ui-monospace, SFMono-Regular, Consolas, monospace;
  --font-size-xs: .6875rem;
  --font-size-sm: .75rem;
  --font-size-md: .875rem;
  --font-size-lg: 1rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-weight-regular: 400;
  --font-weight-medium: 550;
  --font-weight-semibold: 650;
  --font-weight-bold: 700;
  --line-height-tight: 1.25;
  --line-height-compact: 1.4;
  --line-height-body: 1.55;
  --text-display: var(--font-weight-bold) var(--font-size-2xl)/var(--line-height-tight) var(--font-family-ui);
  --text-title: var(--font-weight-semibold) var(--font-size-xl)/var(--line-height-tight) var(--font-family-ui);
  --text-heading: var(--font-weight-semibold) var(--font-size-lg)/var(--line-height-compact) var(--font-family-ui);
  --text-message: var(--font-weight-regular) var(--font-size-lg)/var(--line-height-body) var(--font-family-ui);
  --text-body-strong: var(--font-weight-medium) var(--font-size-md)/var(--line-height-compact) var(--font-family-ui);
  --text-body: var(--font-weight-regular) var(--font-size-md)/var(--line-height-body) var(--font-family-ui);
  --text-label: var(--font-weight-semibold) var(--font-size-sm)/var(--line-height-compact) var(--font-family-ui);
  --text-caption: var(--font-weight-regular) var(--font-size-sm)/var(--line-height-compact) var(--font-family-ui);
  --text-micro: var(--font-weight-bold) var(--font-size-xs)/var(--line-height-tight) var(--font-family-ui);
  --text-code: var(--font-weight-regular) var(--font-size-md)/var(--line-height-body) var(--font-family-code);
  --opacity-disabled: .45;
  --space-2xs: 2px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;
  --space-4xl: 48px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;
  --radius-round: 50%;
  --size-icon-xs: 12px;
  --size-icon-sm: 16px;
  --size-icon: 20px;
  --size-icon-lg: 24px;
  --size-control-sm: 32px;
  --size-control: 38px;
  --size-check: 16px;
  --size-badge: 16px;
  --height-header: 49px;
  --size-avatar: 32px;
  --size-avatar-message: 40px;
  --width-server-rail: 72px;
  --width-channel-sidebar: 240px;
  --width-member-sidebar: 240px;
  --focus-width: 2px;
  --focus-offset: 2px;
  --focus-ring: calc(var(--focus-width) + var(--focus-offset));
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
  --z-ui-dialog-backdrop: 80;
  --z-ui-dialog: 81;
  --z-ui-popover: 90;
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
.dscord-ui .ds-text-display { margin: 0; font: var(--text-display); color: var(--color-text-primary); }
.dscord-ui .ds-text-title { margin: 0; font: var(--text-title); color: var(--color-text-primary); }
.dscord-ui .ds-text-heading { margin: 0; font: var(--text-heading); color: var(--color-text-primary); }
.dscord-ui .ds-text-body-strong { margin: 0; font: var(--text-body-strong); color: var(--color-text-primary); }
.dscord-ui .ds-text-body { margin: 0; font: var(--text-body); color: var(--color-text-normal); }
.dscord-ui .ds-text-label { margin: 0; font: var(--text-label); color: var(--color-text-secondary); }
.dscord-ui .ds-text-caption { margin: 0; font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-text-code { font: var(--text-code); color: var(--color-text-normal); }
.dscord-ui .ds-button { min-height: var(--size-control); padding: 0 var(--space-lg); border: 1px solid transparent; border-radius: var(--radius-md); font: var(--text-body-strong); cursor: pointer; }
.dscord-ui .ds-button-size-sm { min-height: var(--size-control-sm); padding-inline: var(--space-md); }
.dscord-ui .ds-button-size-icon { width: var(--size-control); min-height: var(--size-control); padding: 0; }
.dscord-ui .ds-button svg { width: var(--size-icon-sm); height: var(--size-icon-sm); stroke-width: 2; }
.dscord-ui .ds-button-size-icon svg { width: var(--size-icon); height: var(--size-icon); }
.dscord-ui .ds-button-default { background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-ui .ds-button-default:hover:not(:disabled) { background: var(--color-accent-hover); }
.dscord-ui .ds-button-secondary { background: var(--color-bg-neutral); color: var(--color-text-primary); }
.dscord-ui .ds-button-secondary:hover:not(:disabled) { background: var(--color-bg-neutral-hover); }
.dscord-ui .ds-button-ghost { background: transparent; color: var(--color-text-secondary); }
.dscord-ui .ds-button-ghost:hover:not(:disabled) { background: var(--color-bg-hover); color: var(--color-text-primary); }
.dscord-ui .ds-button-destructive { background: var(--color-bg-danger); color: var(--color-text-danger); }
.dscord-ui .ds-button-destructive:hover:not(:disabled) { background: var(--color-border-danger); color: var(--color-text-on-accent); }
.dscord-ui .ds-button:focus-visible, .dscord-ui .ds-input:focus-visible, .dscord-ui .ds-select-trigger:focus-visible, .dscord-ui .ds-chip:focus-visible, .dscord-ui .ds-popover-content:focus-visible, .dscord-ui .ds-dialog-content:focus-visible, .dscord-ui .ds-checkbox:focus-visible, .dscord-ui .ds-radio:focus-visible, .dscord-ui .ds-color-input:focus-visible { outline: var(--focus-width) solid var(--color-focus); outline-offset: var(--focus-offset); }
.dscord-ui .ds-button:disabled, .dscord-ui .ds-input:disabled { cursor: default; opacity: var(--opacity-disabled); }
.dscord-ui .ds-input { min-height: var(--size-control); padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-input); color: var(--color-text-primary); font: var(--text-body); }
.dscord-ui .ds-input::placeholder { color: var(--color-text-muted); }
.dscord-ui .ds-input[aria-invalid="true"], .dscord-ui .ds-input:user-invalid { border-color: var(--color-border-danger); }
.dscord-ui .ds-textarea { min-height: calc(var(--size-control) * 2.5); resize: vertical; }
.dscord-ui .ds-select-trigger { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); width: 100%; min-width: 0; min-height: var(--size-control); margin: 0; padding: 0 var(--space-sm) 0 var(--space-md); border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-input); color: var(--color-text-primary); font: var(--text-body); text-align: left; cursor: pointer; user-select: none; }
.dscord-ui .ds-select-trigger:hover:not([data-disabled]) { border-color: var(--color-border-strong); }
.dscord-ui .ds-select-trigger[data-popup-open] { border-color: var(--color-accent); }
.dscord-ui .ds-select-trigger[data-disabled] { cursor: default; opacity: var(--opacity-disabled); }
.dscord-ui .ds-select-trigger[aria-invalid="true"] { border-color: var(--color-border-danger); }
.dscord-ui .ds-select-value { overflow: hidden; min-width: 0; text-overflow: ellipsis; white-space: nowrap; }
.dscord-ui .ds-select-value[data-placeholder] { color: var(--color-text-muted); }
.dscord-ui .ds-select-icon { display: grid; flex: 0 0 auto; place-items: center; color: var(--color-text-secondary); transition: transform var(--motion-fast); }
.dscord-ui .ds-select-icon svg { width: var(--size-icon-sm); height: var(--size-icon-sm); }
.dscord-ui .ds-select-trigger[data-popup-open] .ds-select-icon { transform: rotate(180deg); }
.dscord-ui .ds-select-positioner { z-index: var(--z-ui-popover); outline: none; }
.dscord-ui .ds-select-popup { min-width: var(--anchor-width); max-width: calc(100vw - var(--space-lg)); max-height: min(var(--available-height), calc(var(--size-control) * 8)); overflow-y: auto; overscroll-behavior: contain; padding: var(--space-xs); border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-primary); color: var(--color-text-normal); box-shadow: var(--shadow-suggestions); outline: none; scrollbar-width: thin; scrollbar-color: var(--color-scrollbar-thumb) transparent; }
.dscord-ui .ds-select-item { display: grid; grid-template-columns: minmax(0, 1fr) var(--size-icon-sm); align-items: center; gap: var(--space-sm); min-height: var(--size-control-sm); padding: var(--space-xs) var(--space-sm); border-radius: var(--radius-sm); font: var(--text-body); cursor: pointer; outline: none; user-select: none; }
.dscord-ui .ds-select-item[data-highlighted] { background: var(--color-bg-hover); color: var(--color-text-primary); }
.dscord-ui .ds-select-item[data-selected] { color: var(--color-text-primary); }
.dscord-ui .ds-select-item[data-disabled] { cursor: default; opacity: var(--opacity-disabled); }
.dscord-ui .ds-select-item-text { display: grid; min-width: 0; }
.dscord-ui .ds-select-group + .ds-select-group, .dscord-ui .ds-select-item + .ds-select-group { margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px solid var(--color-border-subtle); }
.dscord-ui .ds-select-group-label { padding: var(--space-xs) var(--space-sm); font: var(--text-label); color: var(--color-text-muted); }
.dscord-ui .ds-select-item-description { font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-select-item-indicator { display: grid; place-items: center; color: var(--color-accent); }
.dscord-ui .ds-select-item-indicator svg { width: var(--size-icon-sm); height: var(--size-icon-sm); }
.dscord-ui .ds-checkbox, .dscord-ui .ds-radio { display: inline-grid; place-items: center; flex: 0 0 var(--size-check); width: var(--size-check); height: var(--size-check); margin: 0; padding: 0; border: 1px solid var(--color-border-strong); background: var(--color-bg-input); cursor: pointer; vertical-align: middle; }
.dscord-ui .ds-checkbox { border-radius: var(--radius-sm); }
.dscord-ui .ds-radio { border-radius: var(--radius-round); }
.dscord-ui .ds-checkbox[data-checked] { border-color: var(--color-accent); background: var(--color-accent); }
.dscord-ui .ds-checkbox-indicator { display: grid; place-items: center; color: var(--color-text-on-accent); }
.dscord-ui .ds-checkbox-indicator svg { width: var(--size-icon-xs); height: var(--size-icon-xs); }
.dscord-ui .ds-radio[data-checked] { border-color: var(--color-accent); }
.dscord-ui .ds-radio-indicator { width: var(--space-sm); height: var(--space-sm); border-radius: var(--radius-round); background: var(--color-accent); }
.dscord-ui .ds-checkbox[data-disabled], .dscord-ui .ds-radio[data-disabled] { opacity: var(--opacity-disabled); cursor: default; }
.dscord-ui .ds-color-input { width: calc(var(--size-control) * 1.4); min-height: var(--size-control); padding: var(--space-xs); border: 1px solid var(--color-border-normal); border-radius: var(--radius-md); background: var(--color-bg-input); cursor: pointer; }
.dscord-ui .ds-color-input:disabled { opacity: var(--opacity-disabled); cursor: default; }
.dscord-ui .ds-field { display: grid; gap: var(--space-sm); min-width: 0; margin: 0; padding: 0; border: 0; }
.dscord-ui .ds-field-label { display: flex; align-items: baseline; gap: var(--space-xs); font: var(--text-label); color: var(--color-text-secondary); }
.dscord-ui .ds-field-optional { font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-field-description { margin: 0; font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-field-error { margin: 0; font: var(--text-caption); color: var(--color-text-danger); }
.dscord-ui .ds-field-group { display: grid; gap: var(--space-xl); min-width: 0; }
.dscord-ui .ds-field-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(calc(var(--size-control) * 5), 1fr)); gap: var(--space-lg); }
.dscord-ui .ds-choice { display: grid; grid-template-columns: var(--size-check) minmax(0, 1fr); align-items: start; column-gap: var(--space-md); row-gap: var(--space-2xs); cursor: pointer; }
.dscord-ui .ds-choice > .ds-checkbox, .dscord-ui .ds-choice > .ds-radio { margin-top: var(--space-2xs); }
.dscord-ui .ds-choice-label { font: var(--text-body-strong); color: var(--color-text-primary); }
.dscord-ui .ds-choice-description { grid-column: 2; margin: 0; font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-section { display: grid; gap: var(--space-lg); min-width: 0; }
.dscord-ui .ds-section + .ds-section { padding-top: var(--space-2xl); border-top: 1px solid var(--color-border-divider); }
.dscord-ui .ds-section-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-sm) var(--space-lg); }
.dscord-ui .ds-section-heading { display: grid; gap: var(--space-xs); min-width: 0; }
.dscord-ui .ds-section-title { margin: 0; font: var(--text-heading); color: var(--color-text-primary); }
.dscord-ui .ds-section-description { margin: 0; font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-section-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); }
.dscord-ui .ds-section-body { display: grid; gap: var(--space-lg); min-width: 0; }
.dscord-ui .ds-info-list { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); margin: 0; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: var(--color-bg-secondary); }
.dscord-ui .ds-info-row { display: contents; }
.dscord-ui .ds-info-label, .dscord-ui .ds-info-value { margin: 0; padding: var(--space-md) var(--space-lg); }
.dscord-ui .ds-info-row + .ds-info-row > .ds-info-label, .dscord-ui .ds-info-row + .ds-info-row > .ds-info-value { border-top: 1px solid var(--color-border-subtle); }
.dscord-ui .ds-info-label { font: var(--text-label); color: var(--color-text-secondary); white-space: nowrap; }
.dscord-ui .ds-info-value { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; font: var(--text-body); color: var(--color-text-normal); }
.dscord-ui .ds-info-value-text { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.dscord-ui .ds-info-value-code { font: var(--text-code); }
.dscord-ui .ds-info-value .ds-button { flex: 0 0 auto; }
@media (max-width: 520px) {
  .dscord-ui .ds-info-list { grid-template-columns: minmax(0, 1fr); }
  .dscord-ui .ds-info-label { padding-bottom: 0; }
  .dscord-ui .ds-info-value { padding-top: var(--space-xs); }
  .dscord-ui .ds-info-row + .ds-info-row > .ds-info-value { border-top: 0; }
}
.dscord-ui .ds-chip-group { display: flex; flex-wrap: wrap; gap: var(--space-sm); min-width: 0; }
.dscord-ui .ds-chip { display: inline-flex; align-items: center; gap: var(--space-sm); min-height: var(--size-control-sm); margin: 0; padding: 0 var(--space-md); border: 1px solid var(--color-border-normal); border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); font: var(--text-body-strong); white-space: nowrap; cursor: pointer; transition: background-color var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast); }
.dscord-ui .ds-chip:hover:not([data-disabled]) { background: var(--color-bg-hover); color: var(--color-text-primary); }
.dscord-ui .ds-chip[data-pressed] { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-text-on-accent); }
.dscord-ui .ds-chip[data-disabled] { cursor: default; opacity: var(--opacity-disabled); }
.dscord-ui .ds-chip-count { min-width: var(--size-badge); padding: 0 var(--space-xs); border-radius: var(--radius-pill); background: var(--color-bg-neutral); color: var(--color-text-primary); font: var(--text-micro); line-height: var(--size-badge); text-align: center; }
.dscord-ui .ds-chip[data-pressed] .ds-chip-count { background: var(--color-text-on-accent); color: var(--color-accent); }
.dscord-ui .ds-chip .ds-avatar-slot { display: inline-grid; place-items: center; margin-left: calc(-1 * var(--space-xs)); }
.dscord-ui .ds-empty { display: grid; justify-items: center; gap: var(--space-sm); padding: var(--space-3xl) var(--space-lg); text-align: center; }
.dscord-ui .ds-empty-compact { padding: var(--space-xl) var(--space-lg); }
.dscord-ui .ds-empty-icon { display: grid; place-items: center; width: calc(var(--size-icon-lg) * 2); height: calc(var(--size-icon-lg) * 2); margin-bottom: var(--space-xs); border-radius: var(--radius-round); background: var(--color-bg-secondary); color: var(--color-text-muted); }
.dscord-ui .ds-empty-icon svg { width: var(--size-icon-lg); height: var(--size-icon-lg); }
.dscord-ui .ds-empty-title { margin: 0; font: var(--text-body-strong); color: var(--color-text-primary); }
.dscord-ui .ds-empty-description { max-width: 60ch; margin: 0; font: var(--text-caption); color: var(--color-text-muted); }
.dscord-ui .ds-empty-action { margin-top: var(--space-sm); }
.dscord-ui .ds-scroll-area { min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: var(--focus-ring); scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: var(--color-scrollbar-thumb) transparent; }
.dscord-ui .ds-popover-positioner { z-index: var(--z-ui-popover); max-width: calc(100vw - var(--space-lg)); }
.dscord-ui .ds-popover-content { max-height: calc(100dvh - var(--space-2xl)); overflow-y: auto; overscroll-behavior: contain; border: 1px solid var(--color-border-normal); border-radius: var(--radius-lg); background: var(--color-bg-primary); color: var(--color-text-normal); box-shadow: var(--shadow-suggestions); }
.dscord-ui .ds-dialog-backdrop { position: fixed; inset: 0; z-index: var(--z-ui-dialog-backdrop); background: var(--color-dialog-overlay); }
.dscord-ui .ds-dialog-content { position: fixed; top: 50%; left: 50%; z-index: var(--z-ui-dialog); transform: translate(-50%, -50%); max-height: calc(100dvh - var(--space-3xl)); overflow: hidden; overscroll-behavior: contain; border: 1px solid var(--color-border-normal); border-radius: var(--radius-lg); background: var(--color-bg-primary); color: var(--color-text-normal); box-shadow: var(--shadow-dialog); }
.dscord-ui .ds-dialog-content[data-open] { display: flex; flex-direction: column; }
@media (max-width: 480px) {
  .dscord-ui .ds-dialog-content { width: calc(100vw - var(--space-lg)); max-height: calc(100dvh - var(--space-lg)); }
}
`;
