const CACHE_NAME = "ds-group-shell-v3";
const SHELL_PATHS = [
  "/",
  "/index.html",
  "/client-config.json",
  "/styles.css",
  "/tokens.css",
  "/theme.js",
  "/i18n.js",
  "/locales/components.js",
  "/app.js",
  "/pwa.js",
  "/mention-editor.js",
  "/mention-tokens.js",
  "/attachments.js",
  "/manifest.webmanifest",
  "/icons/favicon.ico",
  "/icons/favicon-32.png",
  "/icons/mark-128.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const SHELL_PATH_SET = new Set(SHELL_PATHS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_PATHS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith("ds-group-shell-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function shellResponse(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    const cacheControl = response.headers.get("Cache-Control") ?? "";
    if (
      response.ok &&
      response.type !== "opaque" &&
      !/\bno-store\b/i.test(cacheControl)
    ) {
      await cache.put(cacheKey, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    if (request.mode === "navigate" && cacheKey === "/index.html") {
      const shell = await cache.match("/index.html");
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !SHELL_PATH_SET.has(url.pathname))
    return;
  const cacheKey = ["/", "/index.html"].includes(url.pathname)
    ? "/index.html"
    : url.pathname;
  event.respondWith(shellResponse(request, cacheKey));
});

// This store contains a notification recipient binding only; no token or message bytes.
function ownerStore(mode, work) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ds-group-notification-owner", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("owner");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("owner", mode);
      let result;
      try {
        result = work(tx.objectStore("owner"));
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => {
        const value = result?.result ?? null;
        db.close();
        resolve(value);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
function validOwner(value) {
  if (
    !value ||
    typeof value.userId !== "string" ||
    !/^@[^\s:]+:[^\s]+$/.test(value.userId) ||
    typeof value.homeCoreUrl !== "string" ||
    (value.centralIssuer !== null && typeof value.centralIssuer !== "string")
  )
    return null;
  try {
    const url = new URL(value.homeCoreUrl);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.origin !== value.homeCoreUrl
    )
      return null;
    return {
      userId: value.userId,
      homeCoreUrl: value.homeCoreUrl,
      centralIssuer: value.centralIssuer,
    };
  } catch {
    return null;
  }
}
const sameOwner = (left, right) =>
  Boolean(
    left &&
      right &&
      left.userId === right.userId &&
      left.homeCoreUrl === right.homeCoreUrl &&
      left.centralIssuer === right.centralIssuer,
  );
// Which conversation each open window shows, so a message there does not pop up over it.
const viewing = new Map();
self.addEventListener("message", (event) => {
  if (!event.source?.url) return;
  const source = new URL(event.source.url);
  if (source.origin !== self.location.origin) return;
  if (event.data?.type === "ds-group:viewing") {
    const roomId = event.data.roomId;
    if (typeof roomId === "string" && roomId.startsWith("!"))
      viewing.set(event.source.id, roomId);
    else viewing.delete(event.source.id);
    return;
  }
  if (event.data?.type !== "ds-group:set-owner") return;
  const owner = event.data.owner === null ? null : validOwner(event.data.owner);
  if (event.data.owner !== null && !owner) return;
  const locale = LOCALES.includes(event.data.locale) ? event.data.locale : null;
  event.waitUntil(
    ownerStore("readwrite", (store) => {
      if (locale) store.put(locale, "locale");
      return store.put(owner, "current");
    }),
  );
});

const LOCALES = ["zh-CN", "en"];
const WORDS = {
  "zh-CN": {
    group: "群聊",
    image: "[图片]",
    images: "[{count} 张图片]",
    file: "[文件] {name}",
    files: "[{count} 个文件] {name} 等",
    newMessages: "{count} 条新消息",
    said: "{name}：{text}",
    fallback: "发来一条消息",
    testTitle: "DSCord",
    testBody: "通知已开启。有人给你发消息时，这里会显示是谁、在哪里、说了什么。",
  },
  en: {
    group: "Group",
    image: "[Photo]",
    images: "[{count} photos]",
    file: "[File] {name}",
    files: "[{count} files] {name} and more",
    newMessages: "{count} new messages",
    said: "{name}: {text}",
    fallback: "sent a message",
    testTitle: "DSCord",
    testBody:
      "Notifications are on. When someone messages you, you will see who, where and what they said.",
  },
};
const word = (locale, key, values = {}) =>
  (WORDS[locale] ?? WORDS.en)[key].replace(/\{(\w+)\}/g, (_, name) =>
    String(values[name] ?? ""),
  );
// Messages kept per conversation; older ones still count toward the total.
const STACK_LIMIT = 5;

const clean = (value, limit) =>
  typeof value === "string" ? [...value.trim()].slice(0, limit).join("") : "";

/** The message facts Core sends, checked before any of them reaches the screen. */
function messageFacts(payload) {
  if (
    payload.type !== "message" ||
    typeof payload.roomId !== "string" ||
    !payload.roomId.startsWith("!") ||
    typeof payload.eventId !== "string" ||
    !payload.eventId
  )
    return null;
  const sender = payload.sender ?? {};
  let avatar = null;
  try {
    const url = new URL(sender.avatar);
    if (["https:", "http:"].includes(url.protocol)) avatar = url.href;
  } catch {
    /* A sender without a usable picture gets a drawn initial. */
  }
  const attachment = payload.attachment;
  return {
    roomId: payload.roomId,
    eventId: payload.eventId,
    sentAt: Number.isFinite(payload.sentAt) ? payload.sentAt : Date.now(),
    direct: payload.room?.kind === "direct",
    roomName: clean(payload.room?.name, 80),
    sender: {
      id: clean(sender.id, 255),
      colorKey: clean(sender.globalId, 255) || clean(sender.id, 255),
      name: clean(sender.name, 80) || clean(sender.id, 80) || "?",
      avatar,
    },
    text: clean(payload.text, 300),
    attachment:
      attachment && ["image", "file"].includes(attachment.kind)
        ? {
            kind: attachment.kind,
            name: clean(attachment.name, 120),
            count: Number.isSafeInteger(attachment.count)
              ? Math.max(1, Math.min(attachment.count, 100))
              : 1,
          }
        : null,
  };
}

/** One message as a line: what was attached, then what was written. */
function messageLine(facts, locale) {
  const { attachment } = facts;
  let label = "";
  if (attachment?.kind === "image")
    label =
      attachment.count > 1
        ? word(locale, "images", { count: attachment.count })
        : word(locale, "image");
  else if (attachment)
    label = word(locale, attachment.count > 1 ? "files" : "file", attachment);
  return [label, facts.text].filter(Boolean).join(" ") || word(locale, "fallback");
}

/** Title and body for a conversation's unread messages, newest last. */
function present(stack, locale) {
  const latest = stack.messages.at(-1);
  const room = `#${stack.roomName || word(locale, "group")}`;
  const many = stack.count > 1;
  const more = word(locale, "newMessages", { count: stack.count });
  if (stack.direct)
    return {
      title: many ? `${latest.senderName} · ${more}` : latest.senderName,
      body: stack.messages.map((message) => message.line).join("\n"),
    };
  return {
    title: many ? `${room} · ${more}` : `${latest.senderName} · ${room}`,
    body: many
      ? stack.messages
          .map((message) =>
            word(locale, "said", { name: message.senderName, text: message.line }),
          )
          .join("\n")
      : latest.line,
  };
}

function avatarHue(key) {
  let hash = 0;
  for (const character of key)
    hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  return Math.abs(hash) % 360;
}

/** The same initial-on-colour picture the chat shows for someone without a photo. */
async function initialAvatar(sender) {
  if (typeof OffscreenCanvas !== "function") return null;
  try {
    const size = 192;
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext("2d");
    context.fillStyle = `hsl(${avatarHue(sender.colorKey || sender.name)} 34% 43%)`;
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = `600 ${size * 0.46}px system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText([...sender.name][0] ?? "?", size / 2, size / 2 + size * 0.03);
    const bytes = new Uint8Array(
      await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer(),
    );
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function readerLocale() {
  const stored = await ownerStore("readonly", (store) =>
    store.get("locale"),
  ).catch(() => null);
  if (LOCALES.includes(stored)) return stored;
  return /^zh(?:-|$)/i.test(self.navigator?.language ?? "") ? "zh-CN" : "en";
}

async function someoneIsReading(roomId) {
  const windows = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  return windows.some(
    (client) =>
      client.focused &&
      client.visibilityState === "visible" &&
      viewing.get(client.id) === roomId,
  );
}

const conversationTag = (owner, roomId) => `ds-group:${owner.userId}:${roomId}`;

async function showMessage(owner, facts, locale) {
  if (await someoneIsReading(facts.roomId)) return;
  const tag = conversationTag(owner, facts.roomId);
  const shown = (await self.registration.getNotifications({ tag })).find(
    (notification) => notification.data?.roomId === facts.roomId,
  );
  const earlier = Array.isArray(shown?.data?.messages) ? shown.data.messages : [];
  if (earlier.some((message) => message.eventId === facts.eventId)) return;
  const stack = {
    direct: facts.direct,
    roomName: facts.roomName,
    count: (Number.isSafeInteger(shown?.data?.count) ? shown.data.count : 0) + 1,
    messages: [
      ...earlier,
      { eventId: facts.eventId, senderName: facts.sender.name, line: messageLine(facts, locale) },
    ].slice(-STACK_LIMIT),
  };
  const { title, body } = present(stack, locale);
  const icon =
    facts.sender.avatar ?? (await initialAvatar(facts.sender)) ?? "/icons/icon-192.png";
  await self.registration.showNotification(title, {
    body,
    icon,
    badge: "/icons/mark-128.png",
    tag,
    renotify: true,
    timestamp: facts.sentAt,
    lang: locale,
    data: {
      ...owner,
      roomId: facts.roomId,
      // Opening the notification starts at the first message it announced.
      eventId:
        typeof shown?.data?.eventId === "string" ? shown.data.eventId : facts.eventId,
      direct: stack.direct,
      roomName: stack.roomName,
      count: stack.count,
      messages: stack.messages,
    },
  });
}

/** Where a notification opens: the app, at its conversation and message for the bound reader. */
function notificationTarget(data, allowNavigation) {
  const target = new URL("/", self.location.origin);
  if (!allowNavigation) return { url: target.href, roomId: null, eventId: null, userId: null };
  for (const key of ["roomId", "eventId", "userId", "homeCoreUrl", "centralIssuer"])
    if (typeof data[key] === "string" && data[key]) target.searchParams.set(key, data[key]);
  return {
    url: target.href,
    roomId: target.searchParams.get("roomId"),
    eventId: target.searchParams.get("eventId"),
    userId: data.userId,
    homeCoreUrl: data.homeCoreUrl,
    centralIssuer: data.centralIssuer ?? null,
  };
}

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data?.json() ?? null;
  } catch {
    /* Unreadable payloads are dropped. */
  }
  event.waitUntil(
    (async () => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
      const owner = await ownerStore("readonly", (store) =>
        store.get("current"),
      ).catch(() => null);
      // Only the reader this browser is signed in as sees a notification meant for them.
      if (!validOwner(owner) || payload.userId !== owner.userId) return;
      const locale = await readerLocale();
      if (payload.type === "test") {
        await self.registration.showNotification(word(locale, "testTitle"), {
          body: word(locale, "testBody"),
          icon: "/icons/icon-192.png",
          badge: "/icons/mark-128.png",
          lang: locale,
          data: { ...owner },
        });
        return;
      }
      const facts = messageFacts(payload);
      if (facts) await showMessage(owner, facts, locale);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const owner = await ownerStore("readonly", (store) =>
        store.get("current"),
      ).catch(() => null);
      const data = event.notification.data ?? {};
      const target = notificationTarget(
        data,
        sameOwner(validOwner(owner), validOwner(data)),
      );
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const appWindows = windows.filter((client) => {
        const url = new URL(client.url);
        return (
          url.origin === self.location.origin &&
          ["/", "/index.html"].includes(url.pathname)
        );
      });
      const client =
        appWindows.find((window) => window.focused) ?? appWindows[0];
      if (client) {
        try {
          await client.focus();
          client.postMessage({ type: "ds-group:open-room", ...target });
          return;
        } catch {
          /* A closing window can disappear after enumeration. */
        }
      }
      await self.clients.openWindow(target.url);
    })(),
  );
});
