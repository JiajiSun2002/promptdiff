import { useEffect } from 'react';
import { useSettings } from '@/store/settings';
import { UI_LANGS, getDict, type Dict } from './dicts';

export { UI_LANGS, getDict, detectUiLang, type Dict, type UiLang } from './dicts';

/** 组件内使用：随界面语言切换而重新渲染 */
export function useT(): Dict {
  return getDict(useSettings((s) => s.uiLang));
}

/** 组件外使用（store、错误信息）：读取当前界面语言，不订阅 */
export function tr(): Dict {
  return getDict(useSettings.getState().uiLang);
}

/** 同步 <html lang>，便于读屏和浏览器选择字体 */
export function useHtmlLang() {
  const lang = useSettings((s) => s.uiLang);
  useEffect(() => {
    document.documentElement.lang = UI_LANGS.find((l) => l.code === lang)?.htmlLang ?? 'zh-CN';
  }, [lang]);
}
