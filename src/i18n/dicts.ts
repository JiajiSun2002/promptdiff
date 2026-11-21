// 纯模块：不依赖 store，provider 和测试可以直接用
import { zh, type Dict } from './zh';
import { en } from './en';
import { de } from './de';

export type { Dict };
export type UiLang = 'zh' | 'en' | 'de';

export const UI_LANGS: { code: UiLang; short: string; name: string; htmlLang: string }[] = [
  { code: 'zh', short: '中', name: '中文', htmlLang: 'zh-CN' },
  { code: 'en', short: 'EN', name: 'English', htmlLang: 'en' },
  { code: 'de', short: 'DE', name: 'Deutsch', htmlLang: 'de' },
];

export const DICTS: Record<UiLang, Dict> = { zh, en, de };

export function getDict(lang: UiLang): Dict {
  return DICTS[lang] ?? zh;
}

/** 首次访问：浏览器语言为德语 / 英语时用对应语言，否则中文 */
export function detectUiLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): UiLang {
  for (const l of languages) {
    const code = l.toLowerCase();
    if (code.startsWith('zh')) return 'zh';
    if (code.startsWith('de')) return 'de';
    if (code.startsWith('en')) return 'en';
  }
  return 'zh';
}

/** Gemini 判定理由使用的语言（写进提示词） */
export const REASON_LANGUAGE: Record<UiLang, string> = {
  zh: 'Simplified Chinese',
  en: 'English',
  de: 'German',
};
