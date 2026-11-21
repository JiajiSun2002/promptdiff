import { Stepper } from '@/components/Stepper';
import { IconArrowLeft, IconSettings } from '@/components/icons';
import { useSession } from '@/store/session';
import { providerReady, useSettings } from '@/store/settings';
import { CreatePage } from '@/features/create/CreatePage';
import { ComparePage } from '@/features/compare/ComparePage';
import { RefinePage } from '@/features/refine/RefinePage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { cn } from '@/lib/utils';
import { useHtmlLang, useT } from '@/i18n';
import { UiLangSwitch } from '@/components/UiLangSwitch';

function BrandMark() {
  // 两个半括号组成的标识（原型 brand-mark）
  return (
    <span className="relative h-[30px] w-[30px] rounded-[9px] bg-brand shadow-[0_5px_12px_#245ef533]">
      <span className="absolute top-[7px] left-[7px] h-4 w-[7px] rounded-l border-2 border-r-0 border-white" />
      <span className="absolute top-[7px] right-[7px] h-4 w-[7px] rounded-r border-2 border-l-0 border-white" />
    </span>
  );
}

export default function App() {
  useHtmlLang();
  const t = useT();
  const step = useSession((s) => s.step);
  const setStep = useSession((s) => s.setStep);
  const provider = useSettings((s) => s.provider);
  const ready = useSettings(providerReady);
  const settingsOpen = useSettings((s) => s.open);
  const setOpen = useSettings((s) => s.setOpen);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30">
        <div className="flex h-[68px] items-center justify-between border-b border-[#e8ecf3] bg-white/95 px-4 shadow-[0_1px_8px_#14213d06] backdrop-blur sm:px-11">
          <button
            onClick={() => {
              setOpen(false);
              setStep('create');
            }}
            className="flex items-center gap-[11px] text-[19px] font-bold tracking-[-0.55px] text-[#101c38]"
          >
            <BrandMark />
            <span>
              Prompt<span className="text-brand">Diff</span>
            </span>
          </button>

          <nav className="flex items-center gap-2">
            <UiLangSwitch />
            <span
              className={cn(
                'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex',
                ready ? 'bg-chip text-[#63718a]' : 'bg-warn-soft text-warn',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', ready ? 'bg-[#63af83]' : 'bg-warn')} />
              {provider === 'mock' ? t.app.mockBadge : ready ? t.app.gemini : t.app.geminiNoKey}
            </span>
            <button
              onClick={() => setOpen(!settingsOpen)}
              aria-pressed={settingsOpen}
              className={cn('btn-ghost', settingsOpen && 'bg-brand-soft text-brand')}
            >
              <IconSettings />
              <span className="hidden sm:inline">{t.common.settings}</span>
            </button>
          </nav>
        </div>

        <div className="flex h-[58px] items-center justify-center border-b border-[#e8ecf3] bg-white/80 backdrop-blur">
          {settingsOpen ? (
            <button onClick={() => setOpen(false)} className="link-back">
              <IconArrowLeft className="w-3.5" />
              {t.app.backToWorkspace}
            </button>
          ) : (
            <Stepper />
          )}
        </div>
      </header>

      <main className="mx-auto w-[min(1360px,100%-32px)] pt-7 pb-10 sm:w-[min(1360px,100%-64px)]">
        {settingsOpen ? (
          <SettingsPage />
        ) : (
          <>
            {step === 'create' && <CreatePage />}
            {step === 'compare' && <ComparePage />}
            {step === 'refine' && <RefinePage />}
          </>
        )}
      </main>
    </div>
  );
}
