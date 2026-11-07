import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
import { chatUrl, prepareMentions, remarkChat } from '../web/src/markdown.ts';

function render(body) {
  const { source, tokens } = prepareMentions(body);
  const span = ({ node, children }) => {
    const token = tokens[Number(node.properties.dataMention)];
    return token ? createElement('mention', { kind: token.kind, id: token.id }) : createElement('span', null, children);
  };
  return renderToStaticMarkup(createElement(Markdown, {
    remarkPlugins: [remarkGfm, remarkCjkFriendly, [remarkChat, { tokens }]], urlTransform: chatUrl, components: { span },
  }, source));
}
const links = html => [...html.matchAll(/<a href="([^"]*)">(.*?)<\/a>/g)].map(([, href, text]) => ({ href, text }));

test('Bot-style Markdown renders lists, headings, quotes, tables, emphasis and task lists', () => {
  const html = render('## 结果\n\n- 第一项 *斜体*\n- ~~删除~~\n\n> 引用\n\n| 列 | 值 |\n|---|---|\n| a | 1 |\n\n- [x] 完成');
  for (const fragment of ['<h2>结果</h2>', '<li>第一项 <em>斜体</em></li>', '<del>删除</del>', '<blockquote>', '<td>a</td>', 'type="checkbox"'])
    assert.ok(html.includes(fragment), fragment);
});

test('emphasis next to Chinese punctuation still renders, as Bots commonly write it', () => {
  assert.equal(render('**结论：**后面的文字'), '<p><strong>结论：</strong>后面的文字</p>');
  assert.equal(render('这是**“引用”**内容'), '<p>这是<strong>“引用”</strong>内容</p>');
});

test('single newlines inside a paragraph stay line breaks, like chat', () => {
  assert.match(render('第一行\n第二行'), /^<p>第一行<br\/>\n?第二行<\/p>$/);
});

test('mentions survive inside lists and tables and stay literal in code', () => {
  const html = render('- 请 <@@bot:example.org> 处理\n\n| 人 |\n|---|\n| <@&team> |\n\n`<@@bot:example.org>`\n\n    <@@bot:example.org> @everyone');
  assert.ok(html.includes('<li>请 <mention kind="user" id="@bot:example.org"></mention> 处理</li>'));
  assert.ok(html.includes('<td><mention kind="role" id="team"></mention></td>'));
  assert.ok(html.includes('<code>&lt;@@bot:example.org&gt;</code>'));
  assert.ok(html.includes('<pre><code>&lt;@@bot:example.org&gt; @everyone\n</code></pre>'));
  assert.ok(!/[]/.test(html));
});

test('a bare link stops before adjacent Chinese punctuation and before a mention', () => {
  assert.deepEqual(links(render('原文：https://www.w3.org/TR/WCAG22/，还有 (https://nodejs.org/api/test.html).')),
    [{ href: 'https://www.w3.org/TR/WCAG22/', text: 'https://www.w3.org/TR/WCAG22/' },
      { href: 'https://nodejs.org/api/test.html', text: 'https://nodejs.org/api/test.html' }]);
  const html = render('见 https://example.org/a<@@bot:example.org>');
  assert.deepEqual(links(html), [{ href: 'https://example.org/a', text: 'https://example.org/a' }]);
  assert.ok(html.includes('<mention kind="user"'));
});

test('labelled links keep balanced parentheses and Chinese prose outside', () => {
  const url = 'https://example.org/Function_(mathematics)';
  assert.deepEqual(links(render(`[函数](${url})，见上`)), [{ href: url, text: '函数' }]);
  assert.deepEqual(links(render('见[第 2 节](https://www.rfc-editor.org/rfc/rfc4180.html#section-2)，原文如下。')),
    [{ href: 'https://www.rfc-editor.org/rfc/rfc4180.html#section-2', text: '第 2 节' }]);
});

test('only HTTP(S) links are live; raw HTML and images stay inert', () => {
  const html = render('[x](javascript:alert(1)) <b onclick="x">粗</b> ![图](https://example.org/a.png)');
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('&lt;b onclick=&quot;x&quot;&gt;粗&lt;/b&gt;'));
  assert.ok(!html.includes('<img'));
  assert.deepEqual(links(html), [{ href: 'https://example.org/a.png', text: '图' }]);
});

test('fenced code keeps its language class and stays literal', () => {
  const html = render('```ts\nconst a = "**不加粗**";\n```');
  assert.ok(html.includes('<code class="language-ts">const a = &quot;**不加粗**&quot;;\n</code>'));
});

test('previews drop Markdown syntax but keep the words', async () => {
  const { markdownPreview } = await import('../web/src/markdown.ts');
  assert.equal(markdownPreview('## 结果\n**结论：**见 [报告](https://example.org)\n- 第一项 *斜体*\n> 引用 `code`'),
    '结果 结论：见 报告 第一项 斜体 引用 code');
  assert.equal(markdownPreview('| 列 | 值 |\n|---|---|\n| a | 1 |'), '列 值 a 1');
  assert.equal(markdownPreview('```ts\nconst a = 1;\n```'), 'const a = 1;');
  assert.equal(markdownPreview('snake_case_name 和 2*3*4'), 'snake_case_name 和 2*3*4');
});
