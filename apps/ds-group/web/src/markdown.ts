import { parseMentionTokens } from "../mention-tokens.js";

/** One mention token from `parseMentionTokens`, in source order. */
export interface MentionToken {
  start: number;
  end: number;
  kind: "user" | "role" | "everyone" | "here";
  id?: string;
  /** The token as the sender typed it. */
  text: string;
}

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  children?: MarkdownNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
}

const placeholderOpen = "";
const placeholderClose = "";
const placeholder = /(\d+)/g;
const privateMarkers = /[]/g;
/** Chinese prose punctuation that ends a bare link (GFM only stops at ASCII punctuation). */
const linkStop = /[，。；：！？、（）【】《》「」『』“”‘’…]/u;

/**
 * Mentions are `<@…>` tokens that Markdown would read as HTML. They are swapped for
 * private-use placeholders before parsing, then turned back into mention nodes, so a
 * mention works anywhere in the text (lists, tables, quotes) and never inside code.
 */
export function prepareMentions(body: string): {
  source: string;
  tokens: MentionToken[];
} {
  const clean = body.replace(privateMarkers, "");
  const tokens = (parseMentionTokens(clean).tokens as Omit<MentionToken, "text">[]).map(
    (token) => ({ ...token, text: clean.slice(token.start, token.end) }),
  );
  let source = "";
  let offset = 0;
  tokens.forEach((token, index) => {
    source += `${clean.slice(offset, token.start)}${placeholderOpen}${index}${placeholderClose}`;
    offset = token.end;
  });
  return { source: source + clean.slice(offset), tokens };
}

/** Only HTTP(S) destinations become links; anything else renders as plain text. */
export function chatUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "";
}

function text(value: string): MarkdownNode {
  return { type: "text", value };
}

function splitText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const pushLines = (segment: string) => {
    segment.split("\n").forEach((line, index) => {
      if (index) nodes.push({ type: "break" });
      if (line) nodes.push(text(line));
    });
  };
  let offset = 0;
  for (const match of value.matchAll(placeholder)) {
    pushLines(value.slice(offset, match.index));
    nodes.push({
      type: "chatMention",
      children: [],
      data: { hName: "span", hProperties: { dataMention: match[1] } },
    });
    offset = match.index + match[0].length;
  }
  pushLines(value.slice(offset));
  return nodes;
}

/** GFM literal autolinks run through full-width punctuation; cut them where Chinese prose resumes. */
function trimLiteralLink(node: MarkdownNode): MarkdownNode[] {
  const label = node.children?.length === 1 ? node.children[0] : undefined;
  if (label?.type !== "text" || !label.value || !node.url) return [node];
  const literal =
    node.url === label.value ||
    node.url === `http://${label.value}` ||
    node.url === `mailto:${label.value}`;
  if (!literal) return [node];
  const cut = label.value.search(linkStop);
  if (cut < 0) return [node];
  if (cut === 0) return [text(label.value)];
  const kept = label.value.slice(0, cut);
  return [
    { ...node, url: node.url.slice(0, node.url.length - label.value.length + cut), children: [text(kept)] },
    text(label.value.slice(cut)),
  ];
}

function transform(children: MarkdownNode[], tokens: MentionToken[]): MarkdownNode[] {
  const result: MarkdownNode[] = [];
  for (const child of children) {
    // Indented code is not skipped by the mention scanner; put the typed token back.
    if (child.type === "code" || child.type === "inlineCode") {
      result.push({
        ...child,
        value: (child.value ?? "").replace(placeholder, (match, index: string) => tokens[Number(index)]?.text ?? match),
      });
      continue;
    }
    // Raw HTML is shown as the characters the sender typed.
    if (child.type === "html") {
      result.push(...splitText(child.value ?? ""));
      continue;
    }
    if (child.type === "text") {
      result.push(...splitText(child.value ?? ""));
      continue;
    }
    // Remote images are not loaded inline; they become an ordinary link.
    if (child.type === "image") {
      const label = child.alt || child.url || "";
      result.push(
        child.url && chatUrl(child.url)
          ? { type: "link", url: child.url, children: splitText(label) }
          : text(label),
      );
      continue;
    }
    if (child.type === "imageReference") {
      result.push(...splitText(child.alt ?? ""));
      continue;
    }
    // A link to anything but HTTP(S) keeps its label as plain text.
    if (child.type === "link" && !chatUrl(child.url ?? "")) {
      result.push(...transform(child.children ?? [], tokens));
      continue;
    }
    // Trim before the label is split, so a mention right after a bare link stays a mention.
    for (const part of child.type === "link" ? trimLiteralLink(child) : [child]) {
      if (part.type === "text") result.push(...splitText(part.value ?? ""));
      else {
        if (part.children) part.children = transform(part.children, tokens);
        result.push(part);
      }
    }
  }
  return result;
}

/** Remark plugin for chat messages: mentions, single-newline breaks, literal HTML, no inline images. */
export function remarkChat(options: { tokens: MentionToken[] }) {
  return (tree: MarkdownNode) => {
    if (tree.children) tree.children = transform(tree.children, options.tokens);
  };
}
