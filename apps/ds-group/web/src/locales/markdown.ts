const en = {
  copyCode: "Copy code",
  codeCopied: "Copied",
  codeCopyFailed: "Copy failed",
  plainText: "Text",
};
export const markdownMessages = {
  en,
  "zh-CN": {
    copyCode: "复制代码",
    codeCopied: "已复制",
    codeCopyFailed: "复制失败",
    plainText: "文本",
  } satisfies Record<keyof typeof en, string>,
};
