import { describe, expect, it } from 'vitest';
import { parseAiText, stripInline } from './aiText';

describe('AI text rendering', () => {
  it('strips markdown emphasis, code, links and HTML', () => {
    expect(stripInline('**Bold** and *italic* with `code`')).toBe('Bold and italic with code');
    expect(stripInline('See [this](javascript:alert(1)) <script>x</script>')).toBe('See this x');
    expect(stripInline('2 * 3 * 4')).toBe('2 * 3 * 4');
  });

  it('builds headings, paragraphs and lists', () => {
    const blocks = parseAiText('## Summary\nYou logged **5** days.\nNice.\n\n- Protein was steady\n- Fat varied\n\n1. First\n2. Second\n```\ncode\n```');
    expect(blocks).toEqual([
      { type: 'heading', text: 'Summary' },
      { type: 'paragraph', text: 'You logged 5 days. Nice.' },
      { type: 'list', ordered: false, items: ['Protein was steady', 'Fat varied'] },
      { type: 'list', ordered: true, items: ['First', 'Second'] },
      { type: 'paragraph', text: 'code' },
    ]);
  });

  it('caps very long output', () => {
    const blocks = parseAiText('a'.repeat(50000), 100);
    expect(blocks[0]).toEqual({ type: 'paragraph', text: 'a'.repeat(100) });
  });
});
