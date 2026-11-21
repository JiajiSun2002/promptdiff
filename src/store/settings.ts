import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { detectUiLang, type UiLang } from '@/i18n/dicts';

export type ProviderKind = 'mock' | 'gemini';

export const DEFAULT_MODELS = {
  textModel: 'gemini-3.5-flash',
  imageModel: 'gemini-3.1-flash-image',
} as const;

export const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'] as const;

interface SettingsState {
  provider: ProviderKind;
  /** 只存在本机 localStorage，不进代码 / fixture / 仓库 */
  apiKey: string;
  /** 文本 + 视觉模型（翻译抽取、逐条检查） */
  textModel: string;
  imageModel: string;
  aspectRatio: string;
  /** 界面语言（与 prompt 的源语言无关） */
  uiLang: UiLang;
  /** 设置页是否打开（不持久化） */
  open: boolean;

  update: (patch: Partial<Omit<SettingsState, 'update' | 'setOpen'>>) => void;
  setOpen: (open: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      provider: 'mock',
      apiKey: '',
      ...DEFAULT_MODELS,
      aspectRatio: '1:1',
      uiLang: detectUiLang(),
      open: false,
      update: (patch) => set(patch),
      setOpen: (open) => set({ open }),
    }),
    {
      name: 'promptdiff.settings',
      version: 1,
      // localStorage 不可用（隐私模式等）时 zustand 会退化为内存存储
      storage: createJSONStorage(() => localStorage),
      partialize: ({ provider, apiKey, textModel, imageModel, aspectRatio, uiLang }) => ({
        provider,
        apiKey,
        textModel,
        imageModel,
        aspectRatio,
        uiLang,
      }),
    },
  ),
);

/** 当前设置是否可以发起调用 */
export function providerReady(s: Pick<SettingsState, 'provider' | 'apiKey'>): boolean {
  return s.provider === 'mock' || s.apiKey.trim().length > 0;
}
