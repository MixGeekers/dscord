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
// dsh-connect/client/components/forms.tsx
var field = (form, name) => form.elements.namedItem(name);
/** Signs in with a connection key from the DSCord web page; the key never stays in the form. */
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
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("loginHelp")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: "dc-field",
				children: [t("connectionKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
					name: "connectionKey",
					className: "dc-key",
					required: true,
					rows: 4,
					autoComplete: "off",
					autoCapitalize: "none",
					spellCheck: false,
					disabled: busy
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "primary",
				type: "submit",
				className: "dc-primary",
				disabled: busy,
				children: t(state.busy?.action === "login" ? "loggingIn" : "login")
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
		className: "dc-model-settings",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
			className: "dc-model-form",
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
				variant: "primary",
				className: "dc-primary",
				type: "submit",
				disabled: Boolean(state.busy) || !selected || reference === bot.modelSelection?.model,
				children: t("saveModel")
			})]
		}), pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
			className: "dc-model-info",
			role: "status",
			children: t("modelPending")
		})]
	});
}
/**
* Creates a Bot on this node. A creation whose answer was lost keeps its request id in session storage, so trying
* again confirms the same creation instead of making a second Bot.
*/
function CreateLocalBot({ connection, state, value, t }) {
	const catalog = value.models;
	const models = (catalog?.providers || []).flatMap((provider) => provider.models);
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
	const [name, setName] = (0, react.useState)(draft?.input.name || "");
	const [role, setRole] = (0, react.useState)(draft?.input.role || "");
	const [model, setModel] = (0, react.useState)(draft?.input.model || catalog?.defaultSelection?.model || "");
	const [uncertain, setUncertain] = (0, react.useState)(Boolean(draft));
	const disabled = Boolean(state.busy);
	const usable = models.some((item) => item.model === model && !item.needsKey);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "dc-create",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("newBot") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
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
				})) {
					pending.current = null;
					setUncertain(false);
					setName("");
					setRole("");
					try {
						sessionStorage.removeItem(storageKey);
					} catch {}
				} else setUncertain(true);
			},
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("botName"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						name: "botName",
						required: true,
						maxLength: 80,
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
						value: role,
						onChange: (event) => {
							setRole(event.target.value);
							setUncertain(false);
						},
						disabled,
						autoComplete: "off"
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("model"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						name: "localModel",
						required: true,
						value: model,
						onChange: (event) => {
							setModel(event.target.value);
							setUncertain(false);
						},
						disabled,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("noModel")
						}), models.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: item.model,
							disabled: item.needsKey === true,
							children: item.name || item.model
						}, item.model))]
					})]
				}),
				uncertain && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-muted dc-model-info",
					children: t("creationPending")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					type: "submit",
					variant: "primary",
					disabled: disabled || !usable,
					children: t(state.busy?.action === "create-native" ? "creatingLocal" : uncertain ? "confirmCreation" : "createLocal")
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
		className: error ? "dc-error dc-model-info" : "dc-model-info",
		children: error || ok
	});
}
/** The private key for the natural-participation decision service; a saved key is never shown again. */
function DecisionProviderForm({ connection, provider, onSaved, t }) {
	const [busy, setBusy] = (0, react.useState)(false);
	const [feedback, setFeedback] = (0, react.useState)(null);
	const [enabled, setEnabled] = (0, react.useState)(provider?.enabled !== false);
	(0, react.useEffect)(() => {
		setEnabled(provider?.enabled !== false);
	}, [provider?.enabled]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
		className: "dc-private",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("decisionTitle") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: provider ? `${t(provider.configured ? "configured" : "notConfigured")} · ${t(provider.available === true ? "available" : provider.available === false ? "serviceUnavailable" : "availabilityUnknown")}` : t("unknown")
			}),
			provider?.model && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: provider.model
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				onSubmit: async (event) => {
					event.preventDefault();
					const input = event.currentTarget.elements.namedItem("decisionApiKey");
					const apiKey = input.value.trim();
					input.value = "";
					setBusy(true);
					setFeedback(null);
					try {
						onSaved(await connection.kernel("save-decision-provider", {
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-field",
						children: [t("decisionApiKey"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							name: "decisionApiKey",
							type: "password",
							autoComplete: "new-password",
							disabled: busy,
							spellCheck: false,
							autoCapitalize: "none"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-muted dc-model-info",
						children: t("decisionKeyHelp")
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "submit",
						variant: "outline",
						disabled: busy,
						children: t("saveDecision")
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeedbackLine, {
				feedback,
				ok: t("decisionSaved")
			})
		]
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
		className: "dc-memory",
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
			view && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: result.identity?.name || result.id }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-bot-id",
					children: result.id
				}),
				filled.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t(key) }), view[key]?.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
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
							className: "dc-muted",
							children: item.saidBy
						}),
						item.scope && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-muted",
							children: item.scope
						}),
						item.conflicts?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-muted",
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
				}, `${item.id}/${item.revision || ""}`))] }, key)),
				!filled.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted",
					children: t("noMemory")
				}),
				view.historyGaps?.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted dc-model-info",
					children: t("limitedMemory")
				}) : null,
				Object.values(view.budget?.omitted || {}).some((count) => count > 0) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted dc-model-info",
					children: t("shortenedMemory")
				})
			] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: t("memoryHelp")
			})
		]
	});
}
/** One local Bot's activity, how it takes part in conversations, and its memory. */
function LocalBotSettings({ bot, connection, t, onBack }) {
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
		className: "dc-local-settings",
		"aria-label": t("settings"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				disabled: busy,
				onClick: onBack,
				children: t("back")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: bot.name }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-bot-id",
				children: `${t("stableIdentity")} · ${bot.id}`
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
			kernel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-model-info",
				children: t(activity && ACTIVITIES.includes(activity) ? activity : "unknown")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: t("waitHelp")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("participation") }),
			kernel?.desiredAttention?.status === "pending" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: "dc-muted dc-model-info",
				children: t("participationPending")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
					className: "dc-mode-options",
					disabled: busy || loading || !kernel,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
						className: "dc-muted",
						children: t("participation")
					}), MODES.map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-mode-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "participationMode",
							value,
							checked: mode === value,
							onChange: () => setMode(value)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(value) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(`${value}Help`) })] })]
					}, value))]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					type: "submit",
					variant: "primary",
					disabled: busy || loading || !kernel || !mode || mode === current,
					children: t("saveParticipation")
				})]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FeedbackLine, {
				feedback,
				ok: t(feedback && "pending" in feedback && feedback.pending ? "participationPending" : "participationSaved")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalSourceMemory, {
				connection,
				nativeBotId: bot.id,
				t
			})
		]
	});
}
/** The Bots that live on this DSH node: create them, add them to chat servers, and open their settings. */
function LocalKernelPanel({ connection, state, value, t }) {
	const [selected, setSelected] = (0, react.useState)(null);
	const [provider, setProvider] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)(null);
	const [serverUrl, setServerUrl] = (0, react.useState)("");
	(0, react.useEffect)(() => {
		const controller = new AbortController();
		connection.kernel("kernel-state", {}, controller).then((kernel) => {
			if (controller.signal.aborted) return;
			setProvider(kernel.decisionProvider || null);
			setError(null);
		}).catch((reason) => {
			if (!controller.signal.aborted) setError(message(reason));
		});
		return () => controller.abort();
	}, [connection]);
	const servers = value.servers || [];
	const target = servers.length === 1 ? servers[0].url : serverUrl;
	const detail = value.nativeBots?.find((bot) => bot.id === selected);
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("nativeBots"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("nativeBots") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("nativeHelp")
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error dc-model-info",
				children: error
			}),
			detail ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalBotSettings, {
				bot: detail,
				connection,
				t,
				onBack: () => setSelected(null)
			}, detail.id) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
					className: "dc-bots",
					children: (value.nativeBots || []).map((bot) => {
						const bound = value.bots.some((link) => link.nativeBotId === bot.id);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: "dc-bot",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dc-bot-copy",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: bot.name }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dc-bot-id",
										children: bot.id
									}),
									bot.role && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dc-muted",
										children: bot.role
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dc-toolbar",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: busy,
									onClick: () => setSelected(bot.id),
									children: t("settings")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: busy || bound || !bot.model || !value.user || !target,
									onClick: () => void connection.attach(bot.id, void 0, target),
									children: t(bound ? "nativeBound" : "attach")
								})]
							})]
						}, bot.id);
					})
				}),
				servers.length > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("attach"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						value: serverUrl,
						onChange: (event) => setServerUrl(event.target.value),
						disabled: busy,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("chooseServer")
						}), servers.map((server) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: server.url,
							children: server.serverName
						}, server.url))]
					})]
				}),
				!value.nativeBots?.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted dc-model-info",
					children: t("nativeEmpty")
				}),
				!value.user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "dc-muted dc-model-info",
					children: t("signInToAttach")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreateLocalBot, {
					connection,
					state,
					value,
					t
				})
			] }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DecisionProviderForm, {
				connection,
				provider,
				onSaved: setProvider,
				t
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: t("nativeLifecycle")
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
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("updateTitle") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-model-info",
				children: t("updateCurrent", { version: view.current }) + (view.serverProtocol ? ` · ${t("updateProtocol", { protocol: view.serverProtocol })}` : "")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: view.phase === "failed" || view.compatible === false ? "dc-error dc-model-info" : "dc-muted dc-model-info",
				children: summary
			}),
			view.source && view.source !== "registry" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted dc-model-info",
				children: t("updateNotRegistry")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
				className: "dc-mode-options",
				disabled: busy || installing,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
						className: "dc-muted",
						children: t("updatePolicy")
					}),
					POLICIES.map(([policy, key]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-mode-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "radio",
							name: "kernelUpdatePolicy",
							value: policy,
							checked: view.policy === policy,
							onChange: () => void run("kernel-update-policy", { policy })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(key) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t(`${key}Help`) })] })]
					}, policy)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "dc-mode-option",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: view.channel === "prerelease",
							onChange: (event) => void run("kernel-update-policy", { channel: event.target.checked ? "prerelease" : "stable" })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("updatePrerelease") }) })]
					})
				]
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-toolbar",
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
			}),
			error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				role: "alert",
				className: "dc-error dc-model-info",
				children: error
			})
		]
	});
}
// dsh-connect/client/components/servers.tsx
var STATUS_KEYS = {
	offline: "statusOffline",
	connecting: "statusConnecting",
	online: "statusOnline",
	error: "statusError"
};
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
/** One Bot account on a chat server: its status, connect actions, the local Bot it runs as, and its model. */
function BotRow({ bot, connection, state, value, t }) {
	const [nativeId, setNativeId] = (0, react.useState)("");
	const needsBinding = value.nativeMode && !bot.nativeBotId;
	const busy = state.busy?.botId === bot.id;
	const status = bot.status || "offline";
	const connected = bot.connected || status === "online" || status === "connecting";
	const disabled = Boolean(state.busy);
	const runtimeAvailable = value.runtime?.available !== false;
	const name = bot.name || bot.id;
	const catalog = value.models;
	const nextModel = bot.modelSelection || catalog?.defaultSelection;
	const modelAvailable = catalog?.available !== true || catalog.providers.some((provider) => provider.models.some((model) => model.model === nextModel?.model));
	const blocked = disabled || !runtimeAvailable || !modelAvailable;
	const unbound = (value.nativeBots || []).filter((local) => !value.bots.some((item) => item.nativeBotId === local.id));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		className: "dc-bot",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-bot-identity",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dc-avatar",
					"aria-hidden": true,
					children: Array.from(name)[0]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dc-bot-copy",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-bot-name",
							children: name
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-bot-id",
							children: bot.localpart || bot.id
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-status",
							"data-status": status,
							children: STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status
						}),
						bot.activeModel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-muted dc-model-info",
							children: `${t("activeModel")} · ${bot.activeModel.model}`
						}),
						nextModel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-muted dc-model-info",
							children: `${t("nextModel")} · ${nextModel.model}`
						}),
						!modelAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-error dc-bot-error",
							children: t("modelUnavailable")
						}),
						bot.lastError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dc-error dc-bot-error",
							children: bot.lastError
						})
					]
				})]
			}),
			needsBinding ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: "dc-model-form",
				onSubmit: (event) => {
					event.preventDefault();
					connection.attach(nativeId, bot.id);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "dc-field",
					children: [t("bind"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						value: nativeId,
						onChange: (event) => setNativeId(event.target.value),
						disabled,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("chooseNative")
						}), unbound.map((local) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: local.id,
							children: local.name
						}, local.id))]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					type: "submit",
					variant: "primary",
					disabled: disabled || !nativeId,
					children: t("bind")
				})]
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dc-actions",
				children: [connected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					type: "button",
					disabled,
					onClick: () => void connection.disconnect(bot.id),
					"aria-label": t("disconnectBot", { name }),
					children: t(busy && state.busy?.action === "disconnect" ? "disconnecting" : "disconnect")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					type: "button",
					className: "dc-primary",
					disabled: blocked,
					onClick: () => void connection.connect(bot.id),
					"aria-label": t("connectBot", { name }),
					children: t(busy ? "connecting" : "connect")
				}), (connected || status === "error") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					type: "button",
					disabled: blocked,
					onClick: () => void connection.reconnect(bot.id),
					"aria-label": t("reconnectBot", { name }),
					children: t(busy && state.busy?.action === "reconnect" ? "reconnecting" : "reconnect")
				})]
			}),
			!needsBinding && catalog?.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelForm, {
				bot,
				connection,
				state,
				value,
				t
			}, JSON.stringify(bot.modelSelection))
		]
	});
}
/** Searches central's server index and adds a listed server in one step. */
function ServerSearch({ connection, state, value, t }) {
	const [results, setResults] = (0, react.useState)(null);
	const [searching, setSearching] = (0, react.useState)(false);
	const [error, setError] = (0, react.useState)("");
	const added = new Set((value.servers || []).map((server) => origin(server.url)));
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dc-server-search",
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
				className: "dc-model-form",
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
				className: "dc-muted",
				children: error || (results && !results.length ? t("noServerResults") : t("searchServersHelp"))
			}),
			results && results.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-bots dc-server-list",
				"aria-label": t("searchServers"),
				children: results.map((server) => {
					const isAdded = server.added || added.has(server.origin);
					const inviteOnly = server.join === "invite" && !isAdded;
					const tags = server.tags?.length ? ` · ${server.tags.map((tag) => `#${tag}`).join(" ")}` : "";
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "dc-bot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-bot-copy",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: server.name }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-server",
									children: `${t("serverNumber", { number: server.number })} · ${server.origin}`
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-muted",
									children: t("serverMembers", {
										people: server.members?.people ?? 0,
										bots: server.members?.bots ?? 0
									}) + tags
								}),
								server.description && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-muted",
									children: server.description
								}),
								inviteOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dc-muted",
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
/** The chat servers this account has added, with search and add-by-address. */
function ServersPanel(props) {
	const { connection, state, value, t } = props;
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dc-panel",
		"aria-label": t("servers"),
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("servers") }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("serversHelp")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "dc-bots dc-server-list",
				children: (value.servers || []).map((server) => {
					const href = webUrl(server.url);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "dc-bot",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-bot-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: server.serverName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dc-server",
								children: server.url
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dc-toolbar",
							children: [href && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								className: "dc-link",
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
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServerSearch, { ...props }),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AddServerForm, {
				connection,
				state,
				t
			})
		]
	});
}
function AddServerForm({ connection, state, t }) {
	const busy = Boolean(state.busy);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
		className: "dc-model-form",
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
				children: [t("inviteCodeOptional"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
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
// dsh-connect/client/components/page.tsx
/** The signed-in account, its chat servers, and the Bots it has on each. */
function AccountSections(props) {
	const { connection, state, value, t } = props;
	const user = value.user;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "dc-panel dc-account",
			"aria-label": t("account"),
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-account-name",
				children: user.name || user.id
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-server",
				children: user.globalId || user.id
			})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				type: "button",
				disabled: Boolean(state.busy),
				onClick: () => void connection.logout(),
				children: t(state.busy?.action === "logout" ? "loggingOut" : "logout")
			})]
		}),
		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ServersPanel, { ...props }),
		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
			className: "dc-panel",
			"aria-label": t("myBots"),
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("myBots") }), value.bots.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "dc-muted",
				children: t("emptyBots")
			}) : (value.servers || []).map((server) => {
				const bots = value.bots.filter((bot) => bot.serverUrl === server.url);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: "dc-server-bots",
					"aria-label": server.serverName,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: server.serverName }), bots.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dc-muted",
						children: t("noServerBots")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: "dc-bots",
						children: bots.map((bot) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BotRow, {
							bot,
							...props
						}, bot.id))
					})]
				}, server.url);
			})]
		})
	] });
}
/** DSCord's page in DSH: sign-in, chat servers, Bots, the local kernel and plugin updates. */
function ConnectionPage({ connection, t }) {
	const state = (0, react.useSyncExternalStore)(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
	const value = state.value;
	const errorMessage = state.errorTranslation ? t(state.errorTranslation.key, state.errorTranslation.params) : state.error;
	const ready = value ? {
		connection,
		state,
		value,
		t
	} : null;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		className: "dscord-connect",
		"aria-label": t("pageLabel"),
		"aria-busy": state.loading || Boolean(state.busy),
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: styles }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: "dc-content",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "dc-header",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dc-toolbar",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							type: "button",
							disabled: state.loading || Boolean(state.busy),
							onClick: () => void connection.refresh(),
							children: t("refresh")
						})
					})]
				}),
				state.notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-notice",
					children: t(state.notice)
				}),
				errorMessage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "dc-notice dc-error",
					children: errorMessage
				}),
				value?.lastError && value.lastError !== errorMessage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "alert",
					className: "dc-notice dc-error",
					children: value.lastError
				}),
				state.loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-muted",
					children: t("readStatus")
				}),
				value?.runtime?.available === false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					className: "dc-notice dc-error",
					children: value.runtime.message || t("runtimeUnavailable")
				}),
				!state.loading && !value?.user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoginForm, {
					connection,
					state,
					t
				}, value?.servers?.[0]?.url || "login"),
				ready?.value.nativeMode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LocalKernelPanel, { ...ready }, `${ready.value.hostId || "local"}/${ready.value.user?.id || "local-owner"}`),
				ready?.value.user && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountSections, { ...ready }),
				value?.kernelUpdates && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KernelUpdatePanel, {
					connection,
					initial: value.kernelUpdates,
					t
				}),
				value?.dataDirectory && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
					className: "dc-directory",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("configDirectory") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: value.dataDirectory })]
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
				notice: action === "save-model" ? "savedModel" : action === "create-native" ? "localCreated" : null
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
		createNative: (payload) => mutate("create-native", payload),
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
	nativeBots: "此节点的 Bot",
	nativeHelp: "Bot 使用 DSCord 自有内核，在自己的节点保留身份、上下文、记忆和工作。创建后可加入聊天服务器。",
	nativeEmpty: "此节点尚无 Bot，可以在这里创建。",
	attach: "加入服务器",
	bind: "绑定已有 Bot",
	chooseNative: "选择本机 Bot",
	nativeBound: "已加入",
	nativeLifecycle: "断开只关闭服务器连接，Bot 的本地对话、记忆和工作继续保留。",
	newBot: "创建 Bot",
	createLocal: "创建到此节点",
	creatingLocal: "正在创建…",
	botName: "名称",
	botRole: "职责或介绍",
	localCreated: "Bot 已创建，可将它加入服务器。",
	settings: "Bot 设置",
	stableIdentity: "本机稳定身份",
	back: "返回 Bot 列表",
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
	participationPending: "已保存，节点将在下次同步时应用。",
	listening: "正在倾听",
	waiting: "正在等待",
	working: "正在工作",
	speaking: "准备发言",
	unknown: "未知",
	waitHelp: "倾听和等待都是正常参与状态。",
	decisionTitle: "参与判断服务",
	decisionApiKey: "判断服务 API key",
	decisionKeyHelp: "仅在此节点私有保存。已保存的 key 不会回显，留空保留现有值。",
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
	memory: "来源记忆",
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
	loadingKernel: "正在读取节点状态…",
	keyPrivate: "凭据只保留在此节点。",
	signInToAttach: "登录服务器后可加入 Bot。",
	kernelConflict: "此节点正在运行旧 Bot 内核。请先停止旧插件，按迁移说明启用 DSCord。",
	serverPolicyDenied: "此服务器未允许所选模型，请选择获准模型或联系管理员。",
	serverOutputLimit: "模型输出上限超过服务器额度，请检查节点与服务器的配置。",
	model: "模型",
	noModel: "请先在 DSH 中配置模型",
	saveModel: "保存选择",
	savedModel: "模型选择已保存。",
	activeModel: "当前运行",
	nextModel: "已选模型",
	modelPending: "点击重连应用新模型。重连会停止当前任务。",
	modelUnavailable: "此模型在 DSH 中不可用，请到 DSH 模型设置检查。",
	missingCredential: "请在 DSH 的模型设置中配置此模型的凭据。",
	invalidEffort: "请检查 DSH 中的模型思考强度设置。",
	invalidOutput: "节点输出 tokens 必须为正整数。",
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
	statusOffline: "已断开",
	statusConnecting: "正在连接",
	statusOnline: "已上线",
	statusError: "连接失败",
	openWeb: "打开网页",
	refresh: "刷新",
	readStatus: "正在读取连接状态…",
	loginHelp: "在 DSCord 网页打开「设置 → 账号 → 连接 DSH」，生成连接密钥后粘贴到这里。密钥 10 分钟内有效，只能用一次。",
	servers: "聊天服务器",
	serversHelp: "一个中央账号可以加入多台聊天服务器，Bot 在每台服务器上分别上线。",
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
	inviteOnlyHint: "这台服务器只接受邀请：在下面填它的地址和成员给你的邀请码再添加。",
	inviteCodeOptional: "邀请码（服务器只接受邀请时填写）",
	removeServer: "移除",
	removeServerLabel: "移除 {server}",
	chooseServer: "选择服务器",
	noServerBots: "这台服务器上还没有你的 Bot。",
	runtimeUnavailable: "Bot 运行环境暂不可用",
	account: "当前账号",
	logout: "退出登录",
	loggingOut: "正在退出…",
	myBots: "我的 Bot",
	emptyBots: "尚未连接 Bot，请从此节点的 Bot 中选择。",
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
	updateNotRegistry: "插件不是从 npm 安装的，请手动安装新版本。"
};
var en = {
	nativeBots: "Bots on this node",
	nativeHelp: "Bots use the DSCord kernel and keep their identity, context, memory and work on their own node. Create one here, then add it to a chat server.",
	nativeEmpty: "There are no Bots on this node yet. Create one here.",
	attach: "Add to server",
	bind: "Bind existing Bot",
	chooseNative: "Choose a local Bot",
	nativeBound: "Added",
	nativeLifecycle: "Disconnecting closes the server connection. The Bot keeps its local chats, memory and work.",
	newBot: "Create Bot",
	createLocal: "Create on this node",
	creatingLocal: "Creating…",
	botName: "Name",
	botRole: "Role or introduction",
	localCreated: "Bot created. You can now add it to the server.",
	settings: "Bot settings",
	stableIdentity: "Stable local identity",
	back: "Back to Bots",
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
	participationPending: "Saved. The node will apply this at its next update.",
	listening: "Listening",
	waiting: "Waiting",
	working: "Working",
	speaking: "Speaking",
	unknown: "Unknown",
	waitHelp: "Listening and waiting are normal participation states.",
	decisionTitle: "Participation service",
	decisionApiKey: "Decision service API key",
	decisionKeyHelp: "Stored privately on this node. Saved keys are never shown; leave blank to keep the current key.",
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
	memory: "Source memory",
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
	loadingKernel: "Loading node status…",
	keyPrivate: "Credentials stay on this node.",
	signInToAttach: "Sign in to a server to add your Bot.",
	kernelConflict: "An older Bot kernel is running on this node. Stop its plugin and follow the migration instructions to enable DSCord.",
	serverPolicyDenied: "This server does not allow the selected model. Choose an allowed model or contact its administrator.",
	serverOutputLimit: "The model output limit exceeds this server’s budget. Check the node and server configuration.",
	model: "Model",
	noModel: "Configure a model in DSH first",
	saveModel: "Save selection",
	savedModel: "Model selection saved.",
	activeModel: "Running model",
	nextModel: "Selected model",
	modelPending: "Reconnect to apply the new model. Reconnecting stops the current task.",
	modelUnavailable: "This model is unavailable in DSH. Check DSH model settings.",
	missingCredential: "Configure this model’s credentials in DSH model settings.",
	invalidEffort: "Check the thinking level in DSH model settings.",
	invalidOutput: "Node output tokens must be a positive integer.",
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
	statusOffline: "Disconnected",
	statusConnecting: "Connecting",
	statusOnline: "Online",
	statusError: "Connection failed",
	openWeb: "Open website",
	refresh: "Refresh",
	readStatus: "Loading connection status…",
	loginHelp: "On the DSCord web page, open Settings → Account → Connect DSH, make a connection key and paste it here. A key works once, within 10 minutes.",
	servers: "Chat servers",
	serversHelp: "One central account can join several chat servers. Each Bot goes online on each server separately.",
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
	inviteOnlyHint: "This server only takes invited people: add it below with its address and the code a member gave you.",
	inviteCodeOptional: "Invitation code (for servers that only take invited people)",
	removeServer: "Remove",
	removeServerLabel: "Remove {server}",
	chooseServer: "Choose a server",
	noServerBots: "You have no Bots on this server yet.",
	runtimeUnavailable: "The Bot runtime is currently unavailable",
	account: "Current account",
	logout: "Sign out",
	loggingOut: "Signing out…",
	myBots: "My Bots",
	emptyBots: "No connected Bots. Choose from the Bots on this node.",
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
	updateNotRegistry: "This plugin was not installed from npm. Install the new version by hand."
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
