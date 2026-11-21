import type { AIProvider } from './provider';
import { mockProvider } from './mock';
import { providerReady, useSettings } from '@/store/settings';
import { getDict } from '@/i18n/dicts';

export type { AIProvider, ExtractResult } from './provider';

/**
 * 按设置返回当前 provider。组件和 store 只通过这里拿 provider。
 * GeminiProvider（及其 SDK）按需加载，Mock / 离线演示不需要下载它。
 */
export async function getProvider(): Promise<AIProvider> {
  const s = useSettings.getState();
  if (s.provider === 'mock') return mockProvider;
  if (!providerReady(s)) throw new Error(getDict(s.uiLang).errors.noKey);
  const { GeminiProvider } = await import('./gemini');
  return new GeminiProvider({
    apiKey: s.apiKey.trim(),
    textModel: s.textModel.trim(),
    imageModel: s.imageModel.trim(),
    aspectRatio: s.aspectRatio,
    uiLang: s.uiLang,
  });
}
