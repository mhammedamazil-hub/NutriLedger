/**
 * Converts model output into simple blocks rendered as plain React text.
 * Markdown markers are stripped (never interpreted as HTML), so model output
 * cannot inject markup, links or scripts.
 */
export type AiBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export function stripInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, '$1') // images → alt text
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1') // links → text only
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?!\s)([^_]+?)_(?!\w)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]{1,200}>/g, '')
    .trim();
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function parseAiText(raw: string, maxChars = 12000): AiBlock[] {
  const text = raw.replace(/\r\n?/g, '\n').slice(0, maxChars);
  const blocks: AiBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      const t = stripInline(para.join(' '));
      if (t) blocks.push({ type: 'paragraph', text: t });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line) || /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) continue; // fences, rules
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      flushList();
      const t = stripInline(h[1] ?? '');
      if (t) blocks.push({ type: 'heading', text: t });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      flushPara();
      const ordered = Boolean(o);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      const t = stripInline((b ?? o)?.[1] ?? '');
      if (t) list.items.push(t);
      continue;
    }
    if (list) {
      // Continuation of the previous list item.
      const last = list.items.length - 1;
      if (last >= 0 && /^\s{2,}/.test(line)) {
        list.items[last] = `${list.items[last]} ${stripInline(line)}`;
        continue;
      }
      flushList();
    }
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}
