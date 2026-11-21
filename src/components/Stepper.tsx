import { useSession, type Step } from '@/store/session';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

export const STEPS: Step[] = ['create', 'compare', 'refine'];

/** 顶栏下方的进度条：圆形编号 + 连线，完成的步骤连线变蓝 */
export function Stepper() {
  const t = useT();
  const step = useSession((s) => s.step);
  const setStep = useSession((s) => s.setStep);
  const hasResults = useSession((s) => (s.session?.iterations.length ?? 0) > 0);
  const current = STEPS.indexOf(step);

  return (
    <nav aria-label={t.steps.nav} className="flex items-center justify-center">
      {STEPS.map((s, i) => {
        const enabled = i === 0 || hasResults;
        const active = i === current;
        const done = i < current;
        return (
          <div key={s} className="flex items-center">
            {i > 0 && (
              <div className={cn('mx-3 h-px w-10 sm:w-20', i <= current ? 'bg-[#aec3fc]' : 'bg-[#dfe4ec]')} />
            )}
            <button
              disabled={!enabled}
              onClick={() => setStep(s)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 py-1 text-[13px] font-semibold disabled:cursor-default',
                active ? 'text-ink-2' : done ? 'text-[#53617a]' : 'text-faint',
              )}
            >
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold transition',
                  active && 'border-brand bg-brand text-white ring-4 ring-[#e9efff]',
                  done && 'border-[#cfdcff] bg-brand-soft text-brand',
                  !active && !done && 'border-[#dfe4ec] bg-[#f2f4f8] text-[#8a95a7]',
                )}
              >
                {done ? '✓' : i + 1}
              </span>
              {t.steps[s]}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
