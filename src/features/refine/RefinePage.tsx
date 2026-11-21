import { useSession } from '@/store/session';
import { CountBadge, PageHeading, langName } from '@/components/shared';
import { IconArrowLeft, IconSparkle } from '@/components/icons';
import { entityColor } from '@/components/entityColors';
import { intentInfo } from '@/features/annotate/intents';
import { useT } from '@/i18n';

export function RefinePage() {
  const t = useT();
  const session = useSession((s) => s.session);
  const setStep = useSession((s) => s.setStep);
  const iteration = session?.iterations[0];
  const annotations = [...(iteration?.annotations ?? [])].sort((a, b) => a.number - b.number);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <button onClick={() => setStep('compare')} className="link-back mb-3">
        <IconArrowLeft className="w-3.5" />
        {t.refine.back}
      </button>
      <PageHeading
        eyebrow={t.steps.stepOf(3, 3)}
        title={t.refine.title}
        desc={t.refine.desc}
        aside={
          <span className="rounded-full border border-[#e0e5ed] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6d798c]">
            {t.refine.badge}
          </span>
        }
      />

      <div className="grid gap-3.5 lg:grid-cols-[0.85fr_1.5fr]">
        {/* 已选标注 */}
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-line-soft px-4 py-3.5">
            <div>
              <strong className="block text-sm text-ink-2">{t.refine.selected}</strong>
              <small className="text-xs text-faint">{t.refine.selectedSub}</small>
            </div>
            <CountBadge n={annotations.length} />
          </header>
          <div className="flex flex-col gap-2 p-3">
            {annotations.length === 0 ? (
              <p className="m-1 text-[13px] leading-relaxed text-[#8a95a7]">
                {t.refine.empty}
              </p>
            ) : (
              annotations.map((a) => {
                const ent = session?.graph.entities.find((e) => e.id === a.entityId);
                const img = iteration?.images.find((i) => i.id === a.imageId);
                const intent = intentInfo(a.intent);
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-[25px_1fr] items-center gap-2.5 rounded-lg border border-[#e8ecf3] bg-[#f8fafe] p-2.5"
                  >
                    <b className="grid h-[23px] w-[23px] place-items-center rounded-full bg-brand text-[11px] text-white">
                      {a.number}
                    </b>
                    <span className="min-w-0">
                      <strong className="flex items-center gap-1.5 text-[13px] text-ink-3">
                        {session && a.entityId && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: entityColor(session.graph, a.entityId).solid }}
                          />
                        )}
                        {ent ? ent.label.src : t.annotate.region}
                        <span className="font-medium text-faint">
                          · {t.annotate.imageOf(img && session ? langName(img.lang, session.srcLang) : '?')}
                        </span>
                      </strong>
                      <small className="block truncate text-xs text-[#8994a7]">
                        {intent.icon} {t.annotate.intents[a.intent]}
                        {a.comment ? ` · ${a.comment}` : ''}
                      </small>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 编辑指令 */}
        <section className="card p-4">
          <label>
            <strong className="block text-sm text-ink-2">{t.refine.instructionTitle}</strong>
            <small className="text-xs text-faint">{t.refine.instructionSub}</small>
            <textarea
              disabled
              rows={7}
              placeholder={t.refine.placeholder}
              className="field mt-3 min-h-[174px] resize-y px-3.5 py-3 text-sm leading-[1.7] disabled:cursor-not-allowed"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-faint">{t.refine.genHint}</p>
            <button disabled className="btn-primary h-10 min-w-[175px]">
              <IconSparkle />
              {t.refine.generate}
            </button>
          </div>
        </section>
      </div>

      {/* 原图 */}
      {iteration && session && (
        <section className="card mt-3.5 p-4">
          <h2 className="mb-3 text-sm font-bold text-ink-2">{t.refine.originals}</h2>
          <div className="grid grid-cols-2 gap-3">
            {iteration.images.map((img) => (
              <figure key={img.id}>
                {img.url && <img src={img.url} alt={img.promptUsed} className="w-full rounded-[9px]" />}
                <figcaption className="mt-1.5 text-xs font-semibold text-muted">
                  {langName(img.lang, session.srcLang)} · {t.image.sample(img.sampleIndex + 1)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
