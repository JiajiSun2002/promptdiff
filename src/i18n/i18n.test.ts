import { describe, expect, it } from 'vitest';
import { DICTS, detectUiLang, type UiLang } from './dicts';

type Node = string | ((...args: never[]) => string) | { [k: string]: Node };

/** 把词典展开成 { 路径: 叶子 } */
function flatten(node: Node, prefix = ''): Record<string, Node> {
  if (typeof node === 'string' || typeof node === 'function') return { [prefix]: node };
  return Object.entries(node).reduce<Record<string, Node>>(
    (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
    {},
  );
}

const flat = Object.fromEntries(Object.entries(DICTS).map(([k, d]) => [k, flatten(d as unknown as Node)])) as Record<
  UiLang,
  Record<string, Node>
>;
const base = flat.zh;

describe('dictionaries', () => {
  for (const lang of ['en', 'de'] as const) {
    it(`${lang} has exactly the same keys as zh`, () => {
      expect(Object.keys(flat[lang]).sort()).toEqual(Object.keys(base).sort());
    });

    it(`${lang} leaves have the same kind and arity as zh`, () => {
      for (const [key, v] of Object.entries(base)) {
        const other = flat[lang][key]!;
        expect(typeof other, key).toBe(typeof v);
        if (typeof v === 'function') expect((other as () => string).length, key).toBe(v.length);
      }
    });
  }

  it('has no empty strings, and functions use every argument', () => {
    for (const [lang, entries] of Object.entries(flat)) {
      for (const [key, v] of Object.entries(entries)) {
        if (typeof v === 'string') {
          expect(v.trim(), `${lang}.${key}`).not.toBe('');
          continue;
        }
        // 用可识别的哨兵值调用，结果里必须出现每个参数
        const args = Array.from({ length: (v as () => string).length }, (_, i) => `ARG${i}`);
        const numeric = Array.from({ length: args.length }, (_, i) => 900 + i);
        const out = (v as (...a: unknown[]) => string)(...args);
        const outN = (v as (...a: unknown[]) => string)(...numeric);
        args.forEach((a, i) => expect(out.includes(a) || outN.includes(String(900 + i)), `${lang}.${key} arg ${i}`).toBe(true));
      }
    }
  });

  it('translations actually differ from Chinese', () => {
    expect(DICTS.en.create.title).not.toBe(DICTS.zh.create.title);
    expect(DICTS.de.create.title).not.toBe(DICTS.en.create.title);
  });
});

describe('detectUiLang', () => {
  it('picks the first supported browser language, defaulting to Chinese', () => {
    expect(detectUiLang(['de-DE', 'en'])).toBe('de');
    expect(detectUiLang(['en-US'])).toBe('en');
    expect(detectUiLang(['fr-FR', 'en-GB'])).toBe('en');
    expect(detectUiLang(['zh-CN', 'en'])).toBe('zh');
    expect(detectUiLang(['fr-FR'])).toBe('zh');
    expect(detectUiLang([])).toBe('zh');
  });
});
