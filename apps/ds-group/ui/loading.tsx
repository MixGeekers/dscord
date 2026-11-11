// The one loading indicator, drawn from the DSCord mark: the whale (the Bot) swims round the bubble (the person), the
// bubble blinks over to where the whale was, the whale swims into the bubble's old place, and back again, while the two
// keep their eyes on each other. Bodies and eyes are cut from assets/dscord/marks/mark-1024.png on one shared square
// canvas; the pictures are small enough to be inlined as data URLs, so the same component works on the web pages,
// both admin consoles and the page inside DSH. The motion is in ui/styles.css (scripts/loading-motion.mjs).
// The words are kept for screen readers only.
import whale from "./loading-whale.png";
import whaleEyes from "./loading-whale-eyes.png";
import human from "./loading-human.png";
import humanEyes from "./loading-human-eyes.png";
import type { CSSProperties } from "react";

const shape = (url: string): CSSProperties => ({
  maskImage: `url("${url}")`,
  WebkitMaskImage: `url("${url}")`,
});

export function Loading({
  label,
  size = "md",
  className,
  id,
}: {
  /** What is being read, e.g. "正在读取记忆…"; read aloud, not shown. */
  label: string;
  /** sm sits inside a line of text, md fills a section, lg fills a page. */
  size?: "sm" | "md" | "lg";
  className?: string;
  id?: string;
}) {
  return (
    <span
      id={id}
      role="status"
      data-slot="loading"
      className={`ds-loading ds-loading-${size}${className ? ` ${className}` : ""}`}
    >
      <span className="ds-loading-stage" aria-hidden="true">
        <span className="ds-loading-mark">
          <span className="ds-loading-human">
            <span className="ds-loading-body" style={shape(human)} />
            <span className="ds-loading-eyes" style={shape(humanEyes)} />
          </span>
          <span className="ds-loading-whale">
            <span className="ds-loading-body" style={shape(whale)} />
            <span className="ds-loading-eyes" style={shape(whaleEyes)} />
          </span>
        </span>
      </span>
      <span className="ds-loading-label">{label}</span>
    </span>
  );
}
