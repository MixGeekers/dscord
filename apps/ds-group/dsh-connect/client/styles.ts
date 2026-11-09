// The page lives inside DSH, so it takes DSH's own --dsw-* tokens and only falls back to plain values.
export const styles = `
.dscord-connect {
  --dc-background: var(--dsw-alias-bg-layer-1, #ffffff);
  --dc-panel: var(--dsw-alias-settings-card-fill, #f7f8fa);
  --dc-field: var(--dsw-alias-bg-layer-1, #ffffff);
  --dc-text: var(--dsw-alias-label-primary, #202124);
  --dc-muted: var(--dsw-alias-label-secondary, #69707a);
  --dc-line: var(--dsw-alias-settings-card-stroke, #e5e7eb);
  --dc-accent: var(--dsw-alias-state-business-primary, #4d6bfe);
  --dc-danger: var(--dsw-alias-state-error-primary, #b42335);
  --dc-success: var(--dsw-alias-state-success-primary, #16794d);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  background: var(--dc-background);
  color: var(--dc-text);
  font: 14px/1.5 var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
body[data-ds-dark-theme] .dscord-connect {
  --dc-background: var(--dsw-alias-bg-layer-1, #1c1c1e);
  --dc-panel: var(--dsw-alias-settings-card-fill, #242426);
  --dc-field: var(--dsw-alias-bg-layer-1, #1c1c1e);
  --dc-text: var(--dsw-alias-label-primary, #f2f3f5);
  --dc-muted: var(--dsw-alias-label-secondary, #b5bac1);
  --dc-line: var(--dsw-alias-settings-card-stroke, #39393d);
  --dc-danger: var(--dsw-alias-state-error-primary, #ff8e99);
  --dc-success: var(--dsw-alias-state-success-primary, #65d7a0);
  color-scheme: dark;
}
.dscord-connect *, .dscord-connect *::before, .dscord-connect *::after { box-sizing: border-box; }
.dscord-connect .dc-content { width: min(100%, 880px); margin: 0 auto; padding: 28px; }
.dscord-connect .dc-header, .dscord-connect .dc-toolbar, .dscord-connect .dc-actions { display: flex; align-items: center; gap: 10px; }
.dscord-connect .dc-header { justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; }
.dscord-connect h1 { margin: 0; font-size: 22px; font-weight: 650; }
.dscord-connect h2 { margin: 0 0 16px; font-size: 17px; font-weight: 600; }
.dscord-connect p { margin: 0; }
.dscord-connect .dc-panel { padding: 22px; border: 1px solid var(--dc-line); border-radius: var(--dsw-radius-lg, 12px); background: var(--dc-panel); margin-bottom: 20px; }
.dscord-connect .dc-login { max-width: 460px; margin: 0 auto; }
.dscord-connect .dc-login > .dc-muted { margin: 0 0 18px; }
.dscord-connect textarea.dc-key { box-sizing: border-box; width: 100%; min-height: 96px; resize: vertical; border: 1px solid var(--dc-line); border-radius: var(--dsw-radius-md, 8px); padding: 10px 12px; background: var(--dc-field); color: var(--dc-text); font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 400; word-break: break-all; }
.dscord-connect textarea.dc-key:focus-visible { outline: 2px solid var(--dc-accent); outline-offset: 1px; }
.dscord-connect .dc-field { display: grid; gap: 7px; margin-bottom: 18px; font-weight: 600; }
.dscord-connect select { width: 100%; min-height: 42px; border: 1px solid var(--dc-line); border-radius: var(--dsw-radius-md, 8px); padding: 10px 12px; background: var(--dc-field); color: var(--dc-text); font: inherit; font-weight: 400; }
.dscord-connect input::placeholder { color: var(--dc-muted); opacity: 1; }
.dscord-connect .dc-link { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 13px; border: 1px solid var(--dc-line); border-radius: 5px; background: var(--dc-panel); color: var(--dc-text); font: inherit; font-weight: 500; text-decoration: none; cursor: pointer; white-space: nowrap; }
.dscord-connect .dc-link:hover { background: var(--dc-field); }
.dscord-connect .dc-login .dc-primary { width: 100%; min-height: 42px; }
.dscord-connect :is(select, summary, a):focus-visible { outline: 2px solid var(--dc-accent); outline-offset: 3px; }
.dscord-connect .dc-muted { color: var(--dc-muted); }
.dscord-connect .dc-error { color: var(--dc-danger); overflow-wrap: anywhere; }
.dscord-connect .dc-notice { padding: 12px 16px; border: 1px solid var(--dc-line); border-radius: 6px; margin-bottom: 18px; background: var(--dc-panel); }
.dscord-connect .dc-account { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.dscord-connect .dc-account > div { min-width: 0; flex: 1; }
.dscord-connect .dc-account > button { flex-shrink: 0; }
.dscord-connect .dc-account-name { font-weight: 600; margin-bottom: 4px; overflow-wrap: anywhere; }
.dscord-connect .dc-server, .dscord-connect .dc-directory { overflow-wrap: anywhere; color: var(--dc-muted); }
.dscord-connect .dc-bots { list-style: none; margin: 0; padding: 0; }
.dscord-connect .dc-server-bots + .dc-server-bots { margin-top: 16px; }
.dscord-connect .dc-server-list { margin: 12px 0; }
.dscord-connect .dc-server-bots h3 { font-size: 13px; margin: 0 0 8px; color: var(--dc-muted); }
.dscord-connect .dc-bot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; padding: 17px 0; border-top: 1px solid var(--dc-line); }
.dscord-connect .dc-bot:first-child { border-top: 0; padding-top: 0; }
.dscord-connect .dc-bot:last-child { padding-bottom: 0; }
.dscord-connect .dc-bot-identity { display: flex; gap: 12px; align-items: center; min-width: 0; }
.dscord-connect .dc-avatar { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 13px; background: var(--dc-field); color: var(--dc-accent); font-size: 18px; font-weight: 600; flex: 0 0 auto; }
.dscord-connect .dc-bot-copy { min-width: 0; }
.dscord-connect .dc-bot-name { font-weight: 600; overflow-wrap: anywhere; }
.dscord-connect .dc-bot-id { color: var(--dc-muted); font-size: 12px; overflow-wrap: anywhere; }
.dscord-connect .dc-status { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--dc-muted); font-size: 13px; }
.dscord-connect .dc-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
.dscord-connect .dc-status[data-status="online"] { color: var(--dc-success); }
.dscord-connect .dc-status[data-status="error"] { color: var(--dc-danger); }
.dscord-connect .dc-status[data-status="connecting"] { color: var(--dc-accent); }
.dscord-connect .dc-bot-error { font-size: 13px; margin-top: 6px; }
.dscord-connect .dc-directory { font-size: 12px; }
.dscord-connect .dc-directory summary { cursor: pointer; width: fit-content; }
.dscord-connect .dc-directory code { display: block; margin-top: 6px; user-select: text; }
.dscord-connect .dc-model-settings { flex-basis: 100%; width: 100%; }
.dscord-connect .dc-model-form { display: flex; align-items: flex-end; gap: 12px; }
.dscord-connect .dc-model-form .dc-field { flex: 1; margin: 0; min-width: 0; }
.dscord-connect .dc-model-form select { max-width: 100%; text-overflow: ellipsis; }
.dscord-connect .dc-model-form button { min-height: 42px; }
.dscord-connect .dc-model-info { margin-top: 7px; font-size: 13px; overflow-wrap: anywhere; }
.dscord-connect .dc-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.dscord-connect .dc-section-heading h2 { margin: 0; }
.dscord-connect .dc-create { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--dc-line); }
.dscord-connect .dc-create .dc-field { margin-bottom: 12px; }
.dscord-connect .dc-create > summary,.dscord-connect .dc-private > summary { cursor: pointer; font-weight: 600; }
.dscord-connect .dc-create form { margin-top: 14px; }
.dscord-connect .dc-local-settings { margin-top: 18px; }
.dscord-connect .dc-local-settings h3 { margin: 20px 0 10px; font-size: 15px; }
.dscord-connect .dc-local-settings .dc-field { margin-bottom: 12px; }
.dscord-connect .dc-mode-options { display: grid; gap: 8px; margin: 12px 0; border: 0; padding: 0; }
.dscord-connect .dc-mode-option { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid var(--dc-line); border-radius: 8px; cursor: pointer; }
.dscord-connect .dc-mode-option input { margin-top: 4px; flex: 0 0 auto; accent-color: var(--dc-accent); }
.dscord-connect .dc-mode-option:has(input:checked) { border-color: var(--dc-accent); }
.dscord-connect .dc-mode-option strong,.dscord-connect .dc-mode-option small { display: block; }
.dscord-connect .dc-mode-option small { margin-top: 3px; color: var(--dc-muted); }
.dscord-connect .dc-private { padding-top: 18px; margin-top: 20px; border-top: 1px solid var(--dc-line); }
.dscord-connect .dc-private .dc-field { margin-top: 12px; }
.dscord-connect .dc-check { display: flex; align-items: center; gap: 8px; margin: 12px 0; }
.dscord-connect .dc-check input { accent-color: var(--dc-accent); }
.dscord-connect .dc-memory { padding-top: 16px; border-top: 1px solid var(--dc-line); margin-top: 20px; }
.dscord-connect .dc-memory-filter { display: flex; gap: 8px; flex-wrap: wrap; margin-block: 12px; }
.dscord-connect .dc-memory-filter select { width: auto; flex: 0 1 140px; }
.dscord-connect .dc-memory-filter input { min-width: 0; flex: 1 1 150px; }
.dscord-connect .dc-memory-list { display: grid; gap: 8px; }
.dscord-connect .dc-memory-item { border: 1px solid var(--dc-line); border-radius: 8px; padding: 12px; margin: 8px 0; overflow-wrap: anywhere; }
.dscord-connect .dc-memory-item p { white-space: pre-wrap; margin-bottom: 8px; }
.dscord-connect .dc-memory-item details { margin-top: 8px; color: var(--dc-muted); font-size: 12px; }
.dscord-connect .dc-memory-item li { margin-block: 8px; overflow-wrap: anywhere; }
.dscord-connect .dc-memory-label { display: inline-block; font-size: 12px; color: var(--dc-muted); border: 1px solid var(--dc-line); border-radius: 4px; padding: 1px 5px; margin: 0 5px 6px 0; }
@media (max-width: 640px) {
  .dscord-connect .dc-model-form { flex-wrap: wrap; }
  .dscord-connect .dc-model-form .dc-field { flex-basis: 100%; }
  .dscord-connect .dc-content { padding: 18px 14px; }
  .dscord-connect .dc-panel { padding: 16px; }
  .dscord-connect .dc-header { gap: 12px; margin-bottom: 18px; }
  .dscord-connect .dc-account { flex-direction: column; align-items: flex-start; gap: 12px; }
  .dscord-connect .dc-account > div { width: 100%; }
  .dscord-connect .dc-bot { align-items: flex-start; flex-direction: column; gap: 12px; }
  .dscord-connect .dc-actions { flex-wrap: wrap; padding-left: 54px; }
  .dscord-connect .dc-toolbar { flex-wrap: wrap; }
}
`;
