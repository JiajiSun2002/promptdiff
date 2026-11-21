import { useEffect, useMemo } from 'react';
import { useSession } from '@/store/session';
import { related } from '@/lib/graph';
import { diffAll, isLanguageGap } from '@/lib/diff';
import { entityColor } from '@/components/entityColors';
import { Card, CountBadge, PageHeading, langCode, langName } from '@/components/shared';
import { IconArrowLeft, IconArrowRight, IconPin, IconTable } from '@/components/icons';
import { cn } from '@/lib/utils';
import { PromptPanel } from './PromptPanel';
import { ImagePanel } from './ImagePanel';
import { CheckMatrix } from './CheckMatrix';
import { AnnotationList } from '@/features/annotate/AnnotationList';
import { useT } from '@/i18n';

export function ComparePage() {
  const t = useT();
  const session = useSession((s) => s.session);
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const setStep = useSession((s) => s.setStep);
  const closeAnnotator = useSession((s) => s.closeAnnotator);
  const iteration = session?.iterations[0];

  useEffect(() => {
    // Esc：先关闭标注面板，再按一次才清除选中
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useSession.getState().annotating) closeAnnotator();
      else select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, closeAnnotator]);

  const rel = useMemo(
    () => (session ? related(session.graph, session.requirements, selectedId) : null),
    [session, selectedId],
  );
  const diffs = useMemo(() => (session && iteration ? diffAll(session, iteration) : {}), [session, iteration]);

  if (!session || !iteration || !rel)
    return <p className="py-20 text-center text-muted">{t.compare.noResults}</p>;

  const srcName = langName('src', session.srcLang);
  const byLang = (lang: 'src' | 'en') =>
    iteration.images.filter((i) => i.lang === lang).sort((a, b) => a.sampleIndex - b.sampleIndex);
  const counts = Object.values(diffs).reduce<Record<string, number>>((acc, d) => {
    const k = isLanguageGap(d.category) ? 'gap' : d.category;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const metrics = [
    { key: 'gap', icon: '⚠', ...t.compare.metrics.gap, tone: 'text-warn', hi: 'bg-warn-soft' },
    { key: 'both_fail', icon: '✗', ...t.compare.metrics.bothFail, tone: 'text-bad', hi: 'bg-bad-soft' },
    { key: 'uncertain', icon: '?', ...t.compare.metrics.uncertain, tone: 'text-warn', hi: 'bg-warn-soft' },
    { key: 'both_pass', icon: '✓', ...t.compare.metrics.bothPass, tone: 'text-ok', hi: 'bg-ok-soft' },
  ];

  return (
    <div>
      <button onClick={() => setStep('create')} className="link-back mb-3">
        <IconArrowLeft className="w-3.5" />
        {t.compare.back}
      </button>
      <PageHeading
        eyebrow={t.steps.stepOf(2, 3)}
        title={t.compare.title}
        desc={t.compare.desc}
        aside={
          <div className="flex items-center gap-2 rounded-lg border border-[#e3e8f0] bg-white py-1.5 pr-2.5 pl-3 text-xs text-[#8490a3]">
            {t.compare.session}
            <strong className="max-w-[260px] truncate text-[13px] text-ink-3">{session.title ?? session.srcPrompt}</strong>
          </div>
        }
      />

      {/* 工作区：prompt | 源语言图 | 英文图 | prompt；窄屏为两列 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[17fr_33fr_33fr_17fr]">
        <PromptPanel
          className="order-1"
          title={srcName}
          code={langCode('src', session.srcLang)}
          subtitle={t.compare.srcPromptSub}
          text={session.srcPrompt}
          lang="src"
          graph={session.graph}
          rel={rel}
        />
        {(['src', 'en'] as const).map((lang) => (
          <div key={lang} className={cn('space-y-3', lang === 'src' ? 'order-3 lg:order-2' : 'order-4 lg:order-3')}>
            {byLang(lang).map((img) => (
              <ImagePanel
                key={img.id}
                image={img}
                session={session}
                checks={iteration.checks}
                rel={rel}
                annotations={iteration.annotations}
              />
            ))}
          </div>
        ))}
        <PromptPanel
          className="order-2 lg:order-4"
          title="English"
          code="EN"
          subtitle={t.compare.enPromptSub}
          text={session.enPrompt}
          lang="en"
          graph={session.graph}
          rel={rel}
        />
      </div>

      {/* 分析区 */}
      <div className="mx-auto mt-4 max-w-[1100px] space-y-3">
        {/* 实体图例 + 清除选中 */}
        <div className="card flex min-h-[46px] flex-wrap items-center gap-2 rounded-[11px] px-3 py-2">
          <span className="mr-1 text-xs font-bold text-[#5e6c83]">{t.compare.entities}</span>
          {session.graph.entities.map((e) => {
            const c = entityColor(session.graph, e.id);
            const on = rel.entityIds.has(e.id);
            return (
              <button
                key={e.id}
                onClick={() => select(e.id)}
                aria-pressed={on}
                style={{ color: on ? '#fff' : c.text, background: on ? c.solid : c.tint }}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? '#fff' : c.solid }} />
                {e.label.src} · {e.label.en}
              </button>
            );
          })}
          <span className="flex-1" />
          <button onClick={() => select(null)} disabled={!selectedId} className="btn-ghost h-7 text-xs">
            {t.common.clearSelection} <kbd className="rounded border border-line px-1 text-[10px]">Esc</kbd>
          </button>
        </div>

        {/* 差异概览 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((m) => {
            const n = counts[m.key] ?? 0;
            return (
              <div key={m.key} className={cn('card rounded-[10px] px-3.5 py-3', n > 0 && m.key !== 'both_pass' && m.hi)}>
                <div className={cn('flex items-center gap-1.5 text-[22px] leading-none font-bold', n > 0 ? m.tone : 'text-faint')}>
                  <span aria-hidden className="text-base">
                    {m.icon}
                  </span>
                  {n}
                </div>
                <div className="mt-1.5 text-xs font-bold text-ink-3">{m.label}</div>
                <div className="text-[11px] text-faint">{m.hint}</div>
              </div>
            );
          })}
        </div>

        <Card
          icon={<IconTable className="w-[15px]" />}
          title={t.compare.matrix}
          aside={<span className="hidden text-xs text-faint sm:inline">{t.compare.matrixHint}</span>}
          bodyClassName="p-0"
        >
          <CheckMatrix session={session} images={iteration.images} checks={iteration.checks} diffs={diffs} rel={rel} />
        </Card>

        <Card
          icon={<IconPin className="w-[15px]" />}
          title={
            <span className="flex items-center gap-2">
              {t.compare.annotations} <CountBadge n={iteration.annotations.length} />
            </span>
          }
          aside={
            <button onClick={() => setStep('refine')} className="btn-primary h-9 px-4 text-[13px]">
              {t.compare.continueRefine}
              <IconArrowRight className="w-3.5" />
            </button>
          }
        >
          <AnnotationList session={session} iteration={iteration} />
        </Card>
      </div>
    </div>
  );
}
