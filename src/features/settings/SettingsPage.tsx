import { useState } from 'react';
import { ASPECT_RATIOS, DEFAULT_MODELS, providerReady, useSettings, type ProviderKind } from '@/store/settings';
import { Card, PageHeading } from '@/components/shared';
import { UiLangSwitch } from '@/components/UiLangSwitch';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

const inputCls = 'field h-10 px-3 text-sm';

export function SettingsPage() {
  const t = useT();
  const s = useSettings();
  const [showKey, setShowKey] = useState(false);
  const ready = providerReady(s);

  const providers: { id: ProviderKind; title: string; desc: string }[] = [
    { id: 'mock', title: 'Mock', desc: t.settings.mockDesc },
    { id: 'gemini', title: 'Gemini', desc: t.settings.geminiDesc },
  ];

  return (
    <div className="mx-auto max-w-[680px]">
      <PageHeading eyebrow={t.common.settings} title={t.settings.title} desc={t.settings.desc} />

      <div className="space-y-3.5">
        <Card title={t.app.uiLanguage} aside={<UiLangSwitch />}>
          <p className="text-xs leading-relaxed text-faint">{t.settings.uiLanguageDesc}</p>
        </Card>

        <Card title={t.settings.provider}>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {providers.map((p) => {
              const on = s.provider === p.id;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => s.update({ provider: p.id })}
                  className={cn(
                    'rounded-[10px] border p-3.5 text-left transition',
                    on
                      ? 'border-brand bg-brand-softer shadow-[0_0_0_3px_#eaf0ff]'
                      : 'border-line bg-white hover:border-brand-line hover:bg-[#fafbfe]',
                  )}
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-ink-2">
                    <span
                      className={cn(
                        'grid h-4 w-4 place-items-center rounded-full border-2',
                        on ? 'border-brand' : 'border-field-line',
                      )}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                    </span>
                    {p.title}
                  </div>
                  <div className="mt-1 pl-6 text-xs text-muted">{p.desc}</div>
                </button>
              );
            })}
          </div>
          {!ready && (
            <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">{t.settings.needKey}</p>
          )}
        </Card>

        <Card title={t.settings.apiKey}>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={s.apiKey}
              onChange={(e) => s.update({ apiKey: e.target.value })}
              placeholder="AIza…"
              autoComplete="off"
              spellCheck={false}
              className={inputCls}
            />
            <button onClick={() => setShowKey((v) => !v)} className="btn-soft h-10 shrink-0">
              {showKey ? t.settings.hide : t.settings.show}
            </button>
            <button onClick={() => s.update({ apiKey: '' })} disabled={!s.apiKey} className="btn-ghost h-10 shrink-0">
              {t.settings.clear}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">{t.settings.keyNote}</p>
        </Card>

        <Card title={t.settings.models}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">{t.settings.textModel}</span>
              <input value={s.textModel} onChange={(e) => s.update({ textModel: e.target.value })} className={inputCls} />
            </label>
            <label>
              <span className="field-label">{t.settings.imageModel}</span>
              <input value={s.imageModel} onChange={(e) => s.update({ imageModel: e.target.value })} className={inputCls} />
            </label>
            <label>
              <span className="field-label">{t.settings.aspectRatio}</span>
              <select
                value={s.aspectRatio}
                onChange={(e) => s.update({ aspectRatio: e.target.value })}
                className={inputCls}
              >
                {ASPECT_RATIOS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => s.update({ ...DEFAULT_MODELS })}
            className="mt-3 text-xs font-semibold text-brand hover:underline"
          >
            {t.settings.resetModels}
          </button>
        </Card>

        <div className="flex justify-end">
          <button onClick={() => s.setOpen(false)} className="btn-primary">
            {t.common.done}
          </button>
        </div>
      </div>
    </div>
  );
}
