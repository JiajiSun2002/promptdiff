import { useMemo } from 'react';
import { useSession } from '@/store/session';
import { promptSegments, type PromptSegment, type Related } from '@/lib/graph';
import { RELATION_COLOR, entityColor } from '@/components/entityColors';
import { cn } from '@/lib/utils';
import type { SceneGraph } from '@/types';
import { useT } from '@/i18n';

interface Props {
  title: string;
  code: string;
  subtitle: string;
  text: string;
  lang: 'src' | 'en';
  graph: SceneGraph;
  rel: Related;
  className?: string;
}

/** prompt 卡片：短语按实体着色（关系为紫色），点击选中对应元素 */
export function PromptPanel({ title, code, subtitle, text, lang, graph, rel, className }: Props) {
  const t = useT();
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const segments = useMemo(() => promptSegments(text, graph, lang), [text, graph, lang]);
  const hasSelection = rel.elementIds.size > 0;

  /** 同一片段覆盖多个元素时，重复点击在它们之间轮换 */
  const onPick = (seg: PromptSegment) => {
    const ids = seg.items.map((it) => it.id);
    const idx = selectedId ? ids.indexOf(selectedId) : -1;
    select(idx >= 0 && ids.length > 1 ? ids[(idx + 1) % ids.length]! : ids[0]!);
  };

  return (
    <section className={cn('card flex min-h-[300px] flex-col px-4 pt-4 pb-3.5', className)}>
      <header className="flex items-center gap-2.5 border-b border-line-soft pb-3.5">
        <span className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-[#dce7ff] bg-brand-soft text-[11px] font-bold text-brand">
          {code}
        </span>
        <div>
          <p className="text-[13px] font-bold text-ink-2">{title}</p>
          <small className="block text-[11px] text-[#8b96a8]">{subtitle}</small>
        </div>
      </header>

      <div className="flex flex-1 items-center px-0.5 py-4">
        <p className={cn('text-[17px] tracking-[-0.18px] text-ink-2', lang === 'src' ? 'leading-[2]' : 'leading-[1.82]')}>
          {segments.map((seg, i) => {
            if (seg.items.length === 0) return <span key={i}>{seg.text}</span>;
            const top = seg.items[0]!;
            const color = top.kind === 'relation' ? RELATION_COLOR : entityColor(graph, top.entityId);
            const active = seg.items.some((it) => rel.elementIds.has(it.id));
            const secondary = !active && top.kind === 'entity' && rel.entityIds.has(top.id);
            const dim = hasSelection && !active && !secondary;
            const label = seg.items.map((it) => `${t.kinds[it.kind]} ${it.id}`).join(', ');
            return (
              <span
                key={i}
                role="button"
                tabIndex={0}
                title={seg.items.length > 1 ? `${label} (${t.prompt.cycleHint})` : label}
                onClick={() => onPick(seg)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(seg))}
                style={{
                  color: color.text,
                  background: color.tint,
                  boxShadow: active
                    ? '0 0 0 2px #fff, 0 0 0 4px currentColor'
                    : secondary
                      ? 'inset 0 0 0 1.5px currentColor'
                      : undefined,
                  opacity: dim ? 0.45 : 1,
                }}
                className={cn(
                  'cursor-pointer rounded px-[3px] py-[2px] font-semibold transition hover:saturate-150 focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_currentColor] focus-visible:outline-none',
                  top.kind === 'attribute' && 'underline decoration-2 underline-offset-4',
                  top.kind === 'relation' && 'underline decoration-dashed decoration-1 underline-offset-4',
                )}
              >
                {seg.text}
              </span>
            );
          })}
        </p>
      </div>

      <footer className="flex items-start gap-2 border-t border-line-soft pt-3">
        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_0_3px_#e8efff]" />
        <p className="text-[11px] leading-relaxed text-[#8a95a7]">{t.prompt.hint}</p>
      </footer>
    </section>
  );
}

