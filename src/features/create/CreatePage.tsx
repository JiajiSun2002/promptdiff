import { useSession } from '@/store/session';
import { providerReady, useSettings } from '@/store/settings';
import { spansFor } from '@/lib/graph';
import { DEMOS } from '@/ai/mock';
import { HighlightedText, SRC_LANGS, langName } from '@/components/shared';
import { IconArrowRight, IconChevron, IconSparkle, IconTranslate } from '@/components/icons';
import { RELATION_COLOR, entityColor } from '@/components/entityColors';
import { cn } from '@/lib/utils';
import type { SceneGraph } from '@/types';
import { useT } from '@/i18n';

export function CreatePage() {
  const t = useT();
  const { srcLang, srcPrompt, session, status, error, selectedId } = useSession();
  const { setSrcLang, setSrcPrompt, setEnPrompt, loadDemo, runExtract, runGenerateAndCheck } = useSession();
  const ready = useSettings(providerReady);
  const isMock = useSettings((s) => s.provider === 'mock');
  const openSettings = useSettings((s) => s.setOpen);
  const busy = status === 'extracting' || status === 'generating';
  const spans = session ? spansFor(session.graph, session.requirements, selectedId) : { src: [], en: [] };
  /** 输入改动后，已有的抽取结果与之不符 */
  const stale = session != null && (session.srcPrompt !== srcPrompt || session.srcLang !== srcLang);

  return (
    <div className="mx-auto w-full max-w-[680px] pt-5">
      <div className="mb-7 text-center">
        <span className="eyebrow">{t.steps.stepOf(1, 3)}</span>
        <h1 className="text-[32px] leading-tight font-bold tracking-[-1px] text-ink">{t.create.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.create.subtitle}</p>
      </div>

      <div className="card rounded-[15px] p-6 shadow-card-lg sm:p-7">
        {/* 语言行 */}
        <div className="grid grid-cols-[1fr_28px_1fr] items-end gap-2.5 border-b border-line-soft pb-6">
          <label>
            <span className="field-label">{t.create.srcLang}</span>
            <select
              value={srcLang}
              onChange={(e) => setSrcLang(e.target.value)}
              className="field h-11 px-3 text-sm font-semibold"
            >
              {SRC_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <span className="grid h-11 place-items-center text-brand" aria-hidden>
            <IconArrowRight />
          </span>
          <label>
            <span className="field-label">{t.create.targetLang}</span>
            <select disabled value="en" className="field h-11 px-3 text-sm font-semibold opacity-70">
              <option value="en">English</option>
            </select>
          </label>
        </div>

        {/* 源 prompt */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="field-label">{t.create.srcPrompt}</span>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-faint">
              {t.create.loadDemo}
              {DEMOS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => loadDemo(d.id)}
                  title={t.demos[d.id].desc}
                  className="rounded-full border border-line bg-chip px-2.5 py-0.5 font-semibold text-[#53617a] hover:border-brand-line hover:bg-brand-soft hover:text-brand"
                >
                  {t.demos[d.id].label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={srcPrompt}
            onChange={(e) => setSrcPrompt(e.target.value)}
            rows={3}
            placeholder={t.create.placeholder}
            className="field min-h-[92px] resize-y px-3.5 py-3 text-[15px] leading-[1.7]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={runExtract} disabled={busy || !ready || !srcPrompt.trim()} className="btn-soft">
              {status === 'extracting' ? (
                <span className="spinner border-brand/30 border-t-brand" />
              ) : (
                <IconTranslate />
              )}
              {status === 'extracting' ? t.create.translating : session && !stale ? t.create.retranslate : t.create.translate}
            </button>
            {stale && <span className="text-xs font-semibold text-warn">{t.create.stale}</span>}
          </div>
          {isMock && <p className="mt-2 text-xs text-faint">{t.create.mockHint}</p>}
          {!ready && (
            <p className="mt-2 text-xs font-semibold text-warn">
              {t.create.noKey}{' '}
              <button onClick={() => openSettings(true)} className="underline">
                {t.create.openSettings}
              </button>
            </p>
          )}
        </div>

        {/* 译文 + scene graph */}
        {session && (
          <div className="mt-6 border-t border-line-soft pt-5">
            <div className="flex items-center justify-between">
              <span className="field-label">{t.create.enPrompt}</span>
              <small className="mb-2 text-xs text-faint">{t.create.enHint}</small>
            </div>
            <textarea
              value={session.enPrompt}
              onChange={(e) => setEnPrompt(e.target.value)}
              rows={2}
              className="field resize-y px-3.5 py-3 text-[15px] leading-[1.7]"
            />
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#5f9778]">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#63af83] text-[9px] text-white">
                ✓
              </span>
              {t.create.translatedSummary(
                session.graph.entities.length,
                session.graph.attributes.length,
                session.graph.relations.length,
              )}
            </div>

            <details className="group mt-4 rounded-[10px] border border-line bg-white" open>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-bold text-ink-3">
                <IconChevron className="w-3.5 text-faint transition group-open:rotate-90" />
                Scene graph
                <span className="text-xs font-medium text-faint">{t.create.sceneGraphHint}</span>
              </summary>
              <div className="space-y-3 border-t border-line-soft px-3 py-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-canvas px-3 py-2">
                    <div className="text-[11px] font-bold text-faint">{langName('src', session.srcLang)}</div>
                    <HighlightedText text={session.srcPrompt} spans={spans.src} className="text-sm text-ink-2" />
                  </div>
                  <div className="rounded-lg bg-canvas px-3 py-2">
                    <div className="text-[11px] font-bold text-faint">English</div>
                    <HighlightedText text={session.enPrompt} spans={spans.en} className="text-sm text-ink-2" />
                  </div>
                </div>
                <GraphChips graph={session.graph} />
              </div>
            </details>
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-5">
          <p className="max-w-[300px] text-xs leading-relaxed text-faint">
            {t.create.actionsHint}
          </p>
          <button
            onClick={runGenerateAndCheck}
            disabled={!session || busy || stale || !ready}
            className="btn-primary min-w-[180px]"
          >
            {status === 'generating' ? <span className="spinner" /> : <IconSparkle />}
            {status === 'generating' ? t.create.generating : t.create.generate}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {t.create.error(error)}
          </p>
        )}
      </div>
    </div>
  );
}

function GraphChips({ graph }: { graph: SceneGraph }) {
  const t = useT();
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const label = (id: string) => graph.entities.find((e) => e.id === id)?.label;

  const groups: { title: string; items: { id: string; text: string; color: { text: string; tint: string } }[] }[] = [
    {
      title: t.kinds.entity,
      items: graph.entities.map((e) => ({
        id: e.id,
        text: `${e.label.src} · ${e.label.en}`,
        color: entityColor(graph, e.id),
      })),
    },
    {
      title: t.kinds.attribute,
      items: graph.attributes.map((a) => ({
        id: a.id,
        text: `${label(a.entityId)?.src}: ${a.value.src} · ${a.value.en}`,
        color: entityColor(graph, a.entityId),
      })),
    },
    {
      title: t.kinds.relation,
      items: graph.relations.map((r) => ({
        id: r.id,
        text: `${label(r.subjectId)?.src} ${r.predicate.src} ${label(r.objectId)?.src} · ${r.predicate.en}`,
        color: RELATION_COLOR,
      })),
    },
  ];

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.title} className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 shrink-0 text-[11px] font-bold text-faint">{g.title}</span>
          {g.items.map((it) => {
            const on = selectedId === it.id;
            return (
              <button
                key={it.id}
                onClick={() => select(it.id)}
                aria-pressed={on}
                style={{ color: it.color.text, background: it.color.tint }}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-semibold transition',
                  on && 'shadow-[0_0_0_2px_#fff,0_0_0_4px_currentColor]',
                )}
              >
                {it.text}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
