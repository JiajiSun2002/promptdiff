import { useSettings } from '@/store/settings';
import { UI_LANGS, useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** 界面语言切换：中 / EN / DE */
export function UiLangSwitch({ className }: { className?: string }) {
  const t = useT();
  const uiLang = useSettings((s) => s.uiLang);
  const update = useSettings((s) => s.update);
  return (
    <div role="radiogroup" aria-label={t.app.uiLanguage} className={cn('flex gap-0.5 rounded-lg bg-[#f1f4f8] p-[3px]', className)}>
      {UI_LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={uiLang === l.code}
          title={l.name}
          lang={l.htmlLang}
          onClick={() => update({ uiLang: l.code })}
          className={cn(
            'h-7 min-w-8 rounded-md px-2 text-xs font-bold transition',
            uiLang === l.code ? 'bg-white text-brand shadow-[0_1px_4px_#202e4e1f]' : 'text-[#6d798c] hover:text-ink-2',
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
