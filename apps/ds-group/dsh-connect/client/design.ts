// Generated from web/tokens.css and ui/styles.css by `npm run build:dsh-client` (scripts/panel-design.mjs). Do not edit by hand.
/** DSCord's design system for the page inside DSH: the web pages' tokens and control styles, kept under one class. */
export const design = `
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
.dscord-ui .ds-loading { display: flex; align-items: center; justify-content: center; padding: var(--space-8); color: var(--color-accent); }
.dscord-ui .ds-loading-sm { display: inline-flex; padding: 0; vertical-align: middle; }
.dscord-ui .ds-loading-lg { padding: var(--space-16); }
.dscord-ui .ds-loading-stage { position: relative; display: block; width: 72px; height: 72px; animation: ds-loading-in 320ms cubic-bezier(.34, 1.56, .64, 1) both; }
.dscord-ui .ds-loading-sm .ds-loading-stage { width: 28px; height: 28px; }
.dscord-ui .ds-loading-lg .ds-loading-stage { width: 112px; height: 112px; }
.dscord-ui .ds-loading-mark { position: absolute; inset: 23%; }
.dscord-ui .ds-loading-whale, .dscord-ui .ds-loading-human, .dscord-ui .ds-loading-body, .dscord-ui .ds-loading-eyes { position: absolute; inset: 0; }
.dscord-ui .ds-loading-whale { z-index: 1; transform-origin: 45.07% 37.97%; animation: ds-loading-whale 3.2s linear infinite; }
.dscord-ui .ds-loading-human { transform-origin: 65.27% 72.43%; animation: ds-loading-human 3.2s linear infinite; }
.dscord-ui .ds-loading-body, .dscord-ui .ds-loading-eyes { mask-size: contain; mask-position: center; mask-repeat: no-repeat; -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; }
.dscord-ui .ds-loading-body { background: currentColor; }
.dscord-ui .ds-loading-eyes { background: var(--color-text-on-accent); }
.dscord-ui .ds-loading-whale .ds-loading-eyes { transform-origin: 48.4% 32.6%; animation: ds-loading-whale-eyes 3.2s linear infinite; }
.dscord-ui .ds-loading-human .ds-loading-eyes { transform-origin: 66.8% 67.8%; animation: ds-loading-human-eyes 3.2s linear infinite; }
.dscord-ui .ds-loading-label { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@keyframes ds-loading-in { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
@keyframes ds-loading-whale { 0% { transform: translate(0%, 0%) rotate(0deg) scale(1, 1); } 3.25% { transform: translate(-.05%, -.08%) rotate(.05deg) scale(1, 1); } 3.75% { transform: translate(-.39%, -.67%) rotate(.39deg) scale(.98, .98); } 4.5% { transform: translate(-1.43%, -2.43%) rotate(1.29deg) scale(.92, .92); } 5.25% { transform: translate(-2.89%, -4.93%) rotate(2.11deg) scale(.84, .84); } 6% { transform: translate(-4.57%, -7.79%) rotate(2.17deg) scale(.75, .75); } 6.5% { transform: translate(-5.7%, -9.72%) rotate(1.57deg) scale(.69, .69); } 7% { transform: translate(-6.76%, -11.54%) rotate(.42deg) scale(.63, .63); } 7.75% { transform: translate(-8.11%, -13.83%) rotate(-2.11deg) scale(.38, .56); } 8.25% { transform: translate(-8.74%, -14.91%) rotate(-4.03deg) scale(.2, .52); } 8.75% { transform: translate(-9.08%, -15.5%) rotate(-5.82deg) scale(.04, .5); } 9.25% { transform: translate(-9.06%, -15.62%) rotate(-7.2deg) scale(-.12, .5); } 9.75% { transform: translate(-8.54%, -15.92%) rotate(-8.2deg) scale(-.27, .5); } 10.25% { transform: translate(-7.51%, -16.49%) rotate(-8.81deg) scale(-.42, .5); } 10.75% { transform: translate(-5.98%, -17.29%) rotate(-9deg) scale(-.5, .5); } 11.25% { transform: translate(-3.96%, -18.27%) rotate(-8.75deg) scale(-.5, .5); } 11.75% { transform: translate(-1.46%, -19.34%) rotate(-8.08deg) scale(-.5, .5); } 12.5% { transform: translate(3.2%, -20.99%) rotate(-6.36deg) scale(-.5, .5); } 13.25% { transform: translate(8.89%, -22.43%) rotate(-3.96deg) scale(-.5, .5); } 14% { transform: translate(15.52%, -23.35%) rotate(-1.13deg) scale(-.5, .5); } 14.75% { transform: translate(22.95%, -23.47%) rotate(1.83deg) scale(-.5, .5); } 15.25% { transform: translate(28.23%, -22.98%) rotate(3.7deg) scale(-.5, .5); } 15.75% { transform: translate(33.7%, -21.95%) rotate(5.4deg) scale(-.5, .5); } 16.25% { transform: translate(39.25%, -20.32%) rotate(6.84deg) scale(-.5, .5); } 16.75% { transform: translate(44.78%, -18.07%) rotate(7.95deg) scale(-.5, .5); } 17.25% { transform: translate(50.19%, -15.18%) rotate(8.68deg) scale(-.5, .5); } 17.75% { transform: translate(55.37%, -11.66%) rotate(8.99deg) scale(-.5, .5); } 18.25% { transform: translate(60.22%, -7.52%) rotate(8.87deg) scale(-.5, .5); } 18.75% { transform: translate(64.63%, -2.83%) rotate(8.31deg) scale(-.5, .5); } 19.25% { transform: translate(68.51%, 2.37%) rotate(7.36deg) scale(-.5, .5); } 19.75% { transform: translate(71.8%, 7.98%) rotate(6.06deg) scale(-.5, .5); } 20.25% { transform: translate(74.44%, 13.91%) rotate(4.46deg) scale(-.5, .5); } 20.75% { transform: translate(76.38%, 20.05%) rotate(2.65deg) scale(-.35, .5); } 21.25% { transform: translate(77.62%, 26.3%) rotate(.71deg) scale(-.19, .5); } 21.75% { transform: translate(78.17%, 32.54%) rotate(-1.27deg) scale(-.04, .5); } 22.25% { transform: translate(78.05%, 38.68%) rotate(-3.18deg) scale(.12, .5); } 22.75% { transform: translate(77.31%, 44.6%) rotate(-4.94deg) scale(.27, .5); } 23.25% { transform: translate(76.01%, 50.24%) rotate(-6.46deg) scale(.42, .5); } 24% { transform: translate(73.21%, 57.99%) rotate(-8.14deg) scale(.5, .5); } 24.75% { transform: translate(69.65%, 64.76%) rotate(-8.95deg) scale(.5, .5); } 25.25% { transform: translate(67.03%, 68.68%) rotate(-8.95deg) scale(.5, .5); } 25.75% { transform: translate(64.31%, 72.12%) rotate(-8.51deg) scale(.5, .5); } 26.25% { transform: translate(61.6%, 75.08%) rotate(-7.67deg) scale(.5, .5); } 27% { transform: translate(57.75%, 78.66%) rotate(-5.74deg) scale(.5, .5); } 27.75% { transform: translate(54.4%, 81.3%) rotate(-3.18deg) scale(.5, .5); } 28.5% { transform: translate(51.79%, 83.1%) rotate(-.28deg) scale(.5, .5); } 29.25% { transform: translate(50.12%, 84.15%) rotate(2.65deg) scale(.5, .5); } 29.75% { transform: translate(49.6%, 84.46%) rotate(4.46deg) scale(.5, .5); } 30.25% { transform: translate(49.49%, 84.42%) rotate(6.04deg) scale(.5, .5); } 30.75% { transform: translate(49.15%, 83.85%) rotate(7.22deg) scale(.51, .51); } 31.25% { transform: translate(48.52%, 82.77%) rotate(7.88deg) scale(.52, .52); } 31.75% { transform: translate(47.63%, 81.26%) rotate(7.99deg) scale(.53, .53); } 32.25% { transform: translate(46.53%, 79.37%) rotate(7.59deg) scale(.55, .55); } 33% { transform: translate(44.55%, 75.99%) rotate(6.2deg) scale(.58, .58); } 34.25% { transform: translate(40.72%, 69.46%) rotate(2.93deg) scale(.64, .64); } 35.25% { transform: translate(37.53%, 64.03%) rotate(.69deg) scale(.69, .69); } 36% { transform: translate(35.29%, 60.2%) rotate(-.29deg) scale(.72, .72); } 36.75% { transform: translate(33.3%, 56.82%) rotate(-.62deg) scale(.75, .75); } 37.5% { transform: translate(31.72%, 54.12%) rotate(-.47deg) scale(.78, .78); } 38.25% { transform: translate(30.68%, 52.34%) rotate(-.16deg) scale(.79, .79); } 38.75% { transform: translate(30.34%, 51.76%) rotate(-.02deg) scale(.8, .8); } 53.25% { transform: translate(30.3%, 51.68%) rotate(-.05deg) scale(.8, .8); } 54.25% { transform: translate(30.19%, 51.5%) rotate(-.96deg) scale(.77, .77); } 55.25% { transform: translate(29.99%, 51.17%) rotate(-2.11deg) scale(.71, .71); } 56% { transform: translate(29.82%, 50.86%) rotate(-2.17deg) scale(.65, .65); } 56.5% { transform: translate(29.7%, 50.66%) rotate(-1.57deg) scale(.61, .61); } 57% { transform: translate(29.58%, 50.47%) rotate(-.42deg) scale(.58, .58); } 57.75% { transform: translate(29.44%, 50.22%) rotate(2.11deg) scale(.53, .53); } 58.75% { transform: translate(29.34%, 50.05%) rotate(5.82deg) scale(.5, .5); } 59.5% { transform: translate(29.07%, 50.19%) rotate(7.75deg) scale(.5, .5); } 60% { transform: translate(28.29%, 50.63%) rotate(8.56deg) scale(.5, .5); } 60.5% { transform: translate(27.01%, 51.33%) rotate(8.96deg) scale(.5, .5); } 61% { transform: translate(25.24%, 52.22%) rotate(8.93deg) scale(.5, .5); } 61.75% { transform: translate(21.66%, 53.8%) rotate(8.08deg) scale(.5, .5); } 62.5% { transform: translate(17%, 55.45%) rotate(6.36deg) scale(.5, .5); } 63.25% { transform: translate(11.31%, 56.89%) rotate(3.96deg) scale(.5, .5); } 64% { transform: translate(4.68%, 57.81%) rotate(1.13deg) scale(.5, .5); } 64.75% { transform: translate(-2.75%, 57.93%) rotate(-1.83deg) scale(.5, .5); } 65.25% { transform: translate(-8.03%, 57.44%) rotate(-3.7deg) scale(.5, .5); } 65.75% { transform: translate(-13.5%, 56.41%) rotate(-5.4deg) scale(.5, .5); } 66.25% { transform: translate(-19.05%, 54.78%) rotate(-6.84deg) scale(.5, .5); } 66.75% { transform: translate(-24.58%, 52.53%) rotate(-7.95deg) scale(.5, .5); } 67.25% { transform: translate(-29.99%, 49.64%) rotate(-8.68deg) scale(.5, .5); } 67.75% { transform: translate(-35.17%, 46.12%) rotate(-8.99deg) scale(.5, .5); } 68.25% { transform: translate(-40.02%, 41.98%) rotate(-8.87deg) scale(.5, .5); } 68.75% { transform: translate(-44.43%, 37.29%) rotate(-8.31deg) scale(.5, .5); } 69.25% { transform: translate(-48.31%, 32.09%) rotate(-7.36deg) scale(.5, .5); } 69.75% { transform: translate(-51.6%, 26.48%) rotate(-6.06deg) scale(.5, .5); } 70.25% { transform: translate(-54.24%, 20.55%) rotate(-4.46deg) scale(.5, .5); } 70.75% { transform: translate(-56.18%, 14.41%) rotate(-2.65deg) scale(.35, .5); } 71.25% { transform: translate(-57.42%, 8.16%) rotate(-.71deg) scale(.19, .5); } 71.75% { transform: translate(-57.97%, 1.92%) rotate(1.27deg) scale(.04, .5); } 72.25% { transform: translate(-57.85%, -4.22%) rotate(3.18deg) scale(-.12, .5); } 72.75% { transform: translate(-57.11%, -10.14%) rotate(4.94deg) scale(-.27, .5); } 73.25% { transform: translate(-55.81%, -15.78%) rotate(6.46deg) scale(-.42, .5); } 74% { transform: translate(-53.01%, -23.53%) rotate(8.14deg) scale(-.5, .5); } 74.75% { transform: translate(-49.45%, -30.3%) rotate(8.95deg) scale(-.5, .5); } 75.25% { transform: translate(-46.83%, -34.22%) rotate(8.95deg) scale(-.5, .5); } 75.75% { transform: translate(-44.11%, -37.66%) rotate(8.51deg) scale(-.5, .5); } 76.25% { transform: translate(-41.4%, -40.62%) rotate(7.67deg) scale(-.5, .5); } 77% { transform: translate(-37.55%, -44.2%) rotate(5.74deg) scale(-.35, .5); } 77.75% { transform: translate(-34.2%, -46.84%) rotate(3.18deg) scale(-.12, .5); } 78.5% { transform: translate(-31.59%, -48.64%) rotate(.28deg) scale(.12, .5); } 79.25% { transform: translate(-29.92%, -49.69%) rotate(-2.65deg) scale(.35, .5); } 79.75% { transform: translate(-29.4%, -50%) rotate(-4.46deg) scale(.5, .5); } 80.25% { transform: translate(-29.26%, -49.92%) rotate(-6.04deg) scale(.5, .5); } 80.75% { transform: translate(-28.75%, -49.05%) rotate(-7.22deg) scale(.51, .51); } 81.25% { transform: translate(-27.79%, -47.41%) rotate(-7.88deg) scale(.53, .53); } 81.75% { transform: translate(-26.44%, -45.1%) rotate(-7.99deg) scale(.55, .55); } 82.25% { transform: translate(-24.75%, -42.22%) rotate(-7.59deg) scale(.58, .58); } 83% { transform: translate(-21.73%, -37.06%) rotate(-6.2deg) scale(.63, .63); } 84% { transform: translate(-17.1%, -29.17%) rotate(-3.59deg) scale(.71, .71); } 85% { transform: translate(-12.23%, -20.87%) rotate(-1.16deg) scale(.79, .79); } 85.75% { transform: translate(-8.71%, -14.86%) rotate(.04deg) scale(.85, .85); } 86.5% { transform: translate(-5.53%, -9.44%) rotate(.58deg) scale(.91, .91); } 87% { transform: translate(-3.7%, -6.31%) rotate(.61deg) scale(.94, .94); } 87.5% { transform: translate(-2.17%, -3.71%) rotate(.47deg) scale(.96, .96); } 88% { transform: translate(-1.01%, -1.72%) rotate(.26deg) scale(.98, .98); } 88.5% { transform: translate(-.26%, -.45%) rotate(.08deg) scale(1, 1); } 89% { transform: translate(0%, 0%) rotate(0deg) scale(1, 1); } 100% { transform: translate(0%, 0%) rotate(0deg) scale(1, 1); } }
@keyframes ds-loading-whale-eyes { 0% { transform: translate(2.53%, 4.31%) scale(1, 1); } 3.75% { transform: translate(2.58%, 4.41%) scale(1, 1); } 5.5% { transform: translate(3.11%, 5.31%) scale(1, 1); } 6.25% { transform: translate(3.52%, 6%) scale(1, 1); } 8.75% { transform: translate(3.54%, 6.04%) scale(1, 1); } 9% { transform: translate(-3.54%, 6.04%) scale(1, 1); } 11% { transform: translate(-3.05%, 6.3%) scale(1, 1); } 13% { transform: translate(-1.61%, 6.81%) scale(1, 1); } 15.25% { transform: translate(.97%, 6.93%) scale(1, 1); } 17% { transform: translate(3.3%, 6.18%) scale(1, 1); } 18.75% { transform: translate(5.36%, 4.5%) scale(1, 1); } 20.25% { transform: translate(6.55%, 2.48%) scale(1, 1); } 21.75% { transform: translate(7%, .23%) scale(1, 1); } 22% { transform: translate(-7%, -.14%) scale(1, 1); } 23.75% { transform: translate(-6.52%, -2.54%) scale(1, 1); } 25.75% { transform: translate(-5.32%, -4.55%) scale(1, 1); } 27.75% { transform: translate(-4.13%, -5.65%) scale(1, 1); } 29.75% { transform: translate(-3.55%, -6.03%) scale(1, 1); } 36% { transform: translate(-3.5%, -5.97%) scale(1, 1); } 38.75% { transform: translate(-3.16%, -5.4%) scale(1, 1); } 45% { transform: translate(-3.16%, -5.39%) scale(1, 1); } 46% { transform: translate(-3.16%, -5.39%) scale(1, .14); } 46.75% { transform: translate(-3.16%, -5.39%) scale(1, .27); } 47.5% { transform: translate(-3.16%, -5.39%) scale(1, 1); } 53.75% { transform: translate(-3.21%, -5.48%) scale(1, 1); } 55.5% { transform: translate(-3.54%, -6.04%) scale(1, 1); } 60% { transform: translate(-3.41%, -6.11%) scale(1, 1); } 61.75% { transform: translate(-2.61%, -6.49%) scale(1, 1); } 63.75% { transform: translate(-.84%, -6.95%) scale(1, 1); } 65.75% { transform: translate(1.63%, -6.81%) scale(1, 1); } 67.5% { transform: translate(3.94%, -5.79%) scale(1, 1); } 69.25% { transform: translate(5.83%, -3.87%) scale(1, 1); } 70.75% { transform: translate(6.78%, -1.74%) scale(1, 1); } 71.75% { transform: translate(7%, -.23%) scale(1, 1); } 72% { transform: translate(-7%, .14%) scale(1, 1); } 73.75% { transform: translate(-6.52%, 2.54%) scale(1, 1); } 75.75% { transform: translate(-5.32%, 4.55%) scale(1, 1); } 77.75% { transform: translate(-4.13%, 5.65%) scale(1, 1); } 78% { transform: translate(-4.01%, 5.74%) scale(1, 1); } 78.25% { transform: translate(3.91%, 5.81%) scale(1, 1); } 80.25% { transform: translate(3.54%, 6.04%) scale(1, 1); } 84.25% { transform: translate(3.47%, 5.92%) scale(1, 1); } 86.5% { transform: translate(2.79%, 4.76%) scale(1, 1); } 89% { transform: translate(2.53%, 4.31%) scale(1, 1); } 95% { transform: translate(2.53%, 4.31%) scale(1, 1); } 96% { transform: translate(2.53%, 4.31%) scale(1, .14); } 96.75% { transform: translate(2.53%, 4.31%) scale(1, .27); } 97.5% { transform: translate(2.53%, 4.31%) scale(1, 1); } 100% { transform: translate(2.53%, 4.31%) scale(1, 1); } }
@keyframes ds-loading-human { 0% { transform: translate(0%, 0%) scale(1, 1); opacity: 1; } 25.75% { transform: translate(0%, 0%) scale(1.1, .89); opacity: 1; } 28% { transform: translate(0%, 0%) scale(1, 1); opacity: 1; } 29.75% { transform: translate(0%, 0%) scale(.13, .13); opacity: .13; } 30% { transform: translate(-20.2%, -34.46%) scale(0, 0); opacity: 0; } 30.5% { transform: translate(-20.2%, -34.46%) scale(.42, .42); opacity: 1; } 31.75% { transform: translate(-20.2%, -34.46%) scale(1.12, 1.12); opacity: 1; } 48% { transform: translate(-20.2%, -34.46%) scale(1, 1); opacity: 1; } 75.75% { transform: translate(-20.2%, -34.46%) scale(1.1, .89); opacity: 1; } 78% { transform: translate(-20.2%, -34.46%) scale(1, 1); opacity: 1; } 79.75% { transform: translate(-20.2%, -34.46%) scale(.13, .13); opacity: .13; } 80% { transform: translate(0%, 0%) scale(0, 0); opacity: 0; } 80.5% { transform: translate(0%, 0%) scale(.42, .42); opacity: 1; } 81.5% { transform: translate(0%, 0%) scale(1.06, 1.06); opacity: 1; } 84.25% { transform: translate(0%, 0%) scale(.99, .99); opacity: 1; } 100% { transform: translate(0%, 0%) scale(1, 1); opacity: 1; } }
@keyframes ds-loading-human-eyes { 0% { transform: translate(-2.53%, -4.31%) scale(1, 1); } 10% { transform: translate(-2.44%, -4.36%) scale(1, 1); } 12.25% { transform: translate(-1.61%, -4.73%) scale(1, 1); } 14.75% { transform: translate(.24%, -4.99%) scale(1, 1); } 16.75% { transform: translate(2.12%, -4.53%) scale(1, 1); } 18.75% { transform: translate(3.83%, -3.21%) scale(1, 1); } 20.75% { transform: translate(4.84%, -1.24%) scale(1, 1); } 22.5% { transform: translate(4.96%, .62%) scale(1, 1); } 25% { transform: translate(4.15%, 2.79%) scale(1, 1); } 27.25% { transform: translate(3.14%, 3.9%) scale(1, 1); } 29.75% { transform: translate(2.53%, 4.31%) scale(1, 1); } 38% { transform: translate(2.53%, 4.31%) scale(1, 1); } 39% { transform: translate(2.53%, 4.31%) scale(1, .14); } 39.75% { transform: translate(2.53%, 4.31%) scale(1, .27); } 40.5% { transform: translate(2.53%, 4.31%) scale(1, 1); } 60% { transform: translate(2.44%, 4.36%) scale(1, 1); } 62.25% { transform: translate(1.61%, 4.73%) scale(1, 1); } 64.75% { transform: translate(-.24%, 4.99%) scale(1, 1); } 66.75% { transform: translate(-2.12%, 4.53%) scale(1, 1); } 68.75% { transform: translate(-3.83%, 3.21%) scale(1, 1); } 70.75% { transform: translate(-4.84%, 1.24%) scale(1, 1); } 72.5% { transform: translate(-4.96%, -.62%) scale(1, 1); } 75% { transform: translate(-4.15%, -2.79%) scale(1, 1); } 77.25% { transform: translate(-3.14%, -3.9%) scale(1, 1); } 79.75% { transform: translate(-2.53%, -4.31%) scale(1, 1); } 88% { transform: translate(-2.53%, -4.31%) scale(1, 1); } 89% { transform: translate(-2.53%, -4.31%) scale(1, .14); } 89.75% { transform: translate(-2.53%, -4.31%) scale(1, .27); } 90.5% { transform: translate(-2.53%, -4.31%) scale(1, 1); } 100% { transform: translate(-2.53%, -4.31%) scale(1, 1); } }
@media (prefers-reduced-motion: reduce) {
  .dscord-ui .ds-loading-stage, .dscord-ui .ds-loading-whale, .dscord-ui .ds-loading-human, .dscord-ui .ds-loading-eyes { animation: none; }
}
`;
