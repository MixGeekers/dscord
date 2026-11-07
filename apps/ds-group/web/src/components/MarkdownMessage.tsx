import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";
import { useTranslation } from "../locale";
import { markdownMessages } from "../locales/markdown";
import { chatUrl, prepareMentions, remarkChat } from "../markdown";
import type { MentionToken } from "../markdown";
import { Icon } from "./Icons";
import "../../markdown.css";

type HighlightJs = typeof import("highlight.js").default;
let highlighter: Promise<HighlightJs> | undefined;
/** The highlighter (common languages only) loads on the first code block that names a language. */
function loadHighlighter() {
  highlighter ??= import("highlight.js/lib/common").then(
    (module) => module.default,
  );
  return highlighter;
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function hastText(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(hastText).join("");
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const t = useTranslation(markdownMessages);
  const [html, setHtml] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setHtml(null);
    if (!language) return;
    let active = true;
    void loadHighlighter()
      .then((hljs) => {
        if (!active || !hljs.getLanguage(language)) return;
        // highlight.js escapes the source; its output only adds span markup.
        setHtml(hljs.highlight(code, { language, ignoreIllegals: true }).value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [code, language]);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(t("codeCopied"));
    } catch {
      setStatus(t("codeCopyFailed"));
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), 2000);
  }

  return (
    <div className="markdown-code">
      <div className="markdown-code-header">
        <span className="markdown-code-language">
          {language || t("plainText")}
        </span>
        <button
          className="markdown-code-copy"
          type="button"
          aria-label={t("copyCode")}
          title={t("copyCode")}
          onClick={() => void copy()}
        >
          <Icon name="copy" />
          <span role="status">{status}</span>
        </button>
      </div>
      <pre className="message-code">
        {html === null ? (
          <code>{code}</code>
        ) : (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </pre>
    </div>
  );
}

export interface MarkdownMessageProps {
  body: string;
  renderMention(token: MentionToken, key: string): ReactNode;
}

/** Renders a chat message body as GitHub-flavoured Markdown with clickable mentions. */
export const MarkdownMessage = memo(function MarkdownMessage(
  props: MarkdownMessageProps,
) {
  const { source, tokens } = useMemo(
    () => prepareMentions(props.body),
    [props.body],
  );
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) =>
        href ? (
          <a
            className="message-link"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ) : (
          <>{children}</>
        ),
      code: ({ children }) => <code className="inline-code">{children}</code>,
      pre: ({ node }) => {
        const code = (node?.children as HastNode[] | undefined)?.find(
          (child) => child.tagName === "code",
        );
        const classes = code?.properties?.className;
        const language =
          (Array.isArray(classes) ? classes : [])
            .map(String)
            .find((name) => name.startsWith("language-"))
            ?.slice("language-".length) ?? "";
        return (
          <CodeBlock
            code={hastText(code).replace(/\n$/, "")}
            language={language.toLowerCase()}
          />
        );
      },
      table: ({ children }) => (
        <div className="markdown-table">
          <table>{children}</table>
        </div>
      ),
      span: ({ node, children }) => {
        const index = Number(
          (node?.properties as Record<string, unknown> | undefined)
            ?.dataMention,
        );
        const token = Number.isInteger(index) ? tokens[index] : undefined;
        return token ? (
          props.renderMention(token, `mention-${index}`)
        ) : (
          <span>{children}</span>
        );
      },
    }),
    [tokens, props.renderMention],
  );
  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly, [remarkChat, { tokens }]]}
        urlTransform={chatUrl}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
});
