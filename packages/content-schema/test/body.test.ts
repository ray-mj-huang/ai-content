import { describe, expect, it } from 'vitest';
import { countChars, hasText, splitPostBody } from '../src/index.ts';

describe('splitPostBody', () => {
  it('拆出編者觀點到下一個二級標題為止', () => {
    const { main, editorNote } = splitPostBody(
      '摘要\n\n## 編者觀點\n\n觀點\n\n## 延伸閱讀\n\n連結\n',
    );
    expect(editorNote).toBe('\n觀點\n');
    expect(main).toContain('摘要');
    expect(main).toContain('## 延伸閱讀');
    expect(main).not.toContain('觀點');
  });

  it('三級標題不會結束編者觀點段落', () => {
    const { editorNote } = splitPostBody('## 編者觀點\n觀點\n### 小節\n更多');
    expect(editorNote).toBe('觀點\n### 小節\n更多');
  });

  it('沒有編者觀點段落時回傳 null', () => {
    expect(splitPostBody('只有摘要').editorNote).toBeNull();
  });
});

describe('hasText', () => {
  it('只有空白或 HTML 註解視為空', () => {
    expect(hasText(null)).toBe(false);
    expect(hasText('  \n')).toBe(false);
    expect(hasText('\n<!-- 站長撰寫 -->\n')).toBe(false);
    expect(hasText('<!-- 註解 -->有內容')).toBe(true);
  });
});

describe('countChars', () => {
  it('中文字與全形標點各算 1 字，英文單字與數字串算 1 字', () => {
    expect(countChars('你好，世界。')).toBe(6);
    expect(countChars('使用 Claude Code 寫程式')).toBe(2 + 2 + 3);
    expect(countChars("it's 2026")).toBe(2);
  });

  it('不計 ASCII 標點與 Markdown 語法', () => {
    expect(countChars('## **粗體** - [連結](#)')).toBe(4);
  });
});
