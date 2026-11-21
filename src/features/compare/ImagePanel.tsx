import { useSession } from '@/store/session';
import type { Related } from '@/lib/graph';
import { effectiveVerdict } from '@/lib/diff';
import { entityColor } from '@/components/entityColors';
import { VerdictBadge, langName } from '@/components/shared';
import type { Annotation, Box, Check, GeneratedImage, Session } from '@/types';
import { isBox } from '@/lib/annotations';
import { AnnotationPopover } from '@/features/annotate/AnnotationPopover';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

interface Props {
  image: GeneratedImage;
  session: Session;
  checks: Check[];
  rel: Related;
  annotations: Annotation[];
}

/** 该图每个实体首次出现的边界框 */
function firstBoxes(checks: Check[], imageId: string): Record<string, Box> {
  const out: Record<string, Box> = {};
  for (const c of checks) {
    if (c.imageId !== imageId || !c.boxes) continue;
    for (const [eid, box] of Object.entries(c.boxes)) out[eid] ??= box;
  }
  return out;
}

const area = ([x0, y0, x1, y1]: Box) => (x1 - x0) * (y1 - y0);

export function ImagePanel({ image, session, checks, rel, annotations }: Props) {
  const t = useT();
  const selectedId = useSession((s) => s.selectedId);
  const annotating = useSession((s) => s.annotating);
  const openAnnotator = useSession((s) => s.openAnnotator);
  const open = (eid: string) => openAnnotator(image.id, eid);
  const mine = annotations.filter((a) => a.imageId === image.id);
  const nextNumber = annotations.reduce((m, a) => Math.max(m, a.number), 0) + 1;
  const editing = annotating?.imageId === image.id ? annotating.entityId : null;

  // 选中某条要求时，用该图这条检查自己的边界框
  const selectedReq = session.requirements.find((r) => r.id === selectedId);
  const reqCheck = selectedReq && checks.find((c) => c.imageId === image.id && c.requirementId === selectedReq.id);
  const boxes = reqCheck?.boxes ?? firstBoxes(checks, image.id);
  // 大框先画，小框在上层，保证被包含的小框可点
  const entries = Object.entries(boxes).sort((a, b) => area(b[1]) - area(a[1]));
  const hasSelection = rel.entityIds.size > 0;
  const label = (eid: string) => {
    const l = session.graph.entities.find((e) => e.id === eid)?.label;
    return l ? (image.lang === 'en' ? l.en : l.src) : eid;
  };

  const mineChecks = checks.filter((c) => c.imageId === image.id);
  const passed = mineChecks.filter((c) => effectiveVerdict(c) === 'yes').length;

  return (
    <figure id={`figure-${image.id}`} className="card p-[11px]">
      <figcaption className="flex min-h-[43px] items-start justify-between gap-2 px-0.5 pb-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-bold text-[#253550]">{langName(image.lang, session.srcLang)}</span>
            <span className="text-[11px] text-faint">{t.image.sample(image.sampleIndex + 1)}</span>
          </div>
          <p className="truncate text-[11px] text-faint">{image.lang === 'en' ? t.image.fromEn : t.image.fromSrc}</p>
        </div>
        {reqCheck ? (
          <VerdictBadge verdict={effectiveVerdict(reqCheck)} title={reqCheck.reason} />
        ) : (
          <span className="rounded-full bg-[#f4f6f9] px-2 py-1 text-[11px] font-semibold text-[#63718a]">{image.model}</span>
        )}
      </figcaption>

      <div className="relative">
        {image.url ? (
          <img
            src={image.url}
            alt={image.promptUsed}
            className="block h-auto w-full rounded-[9px] bg-[#dfe7df] shadow-[inset_0_0_0_1px_#14213d14]"
          />
        ) : (
          <div className="grid aspect-[3/2] place-items-center rounded-[9px] bg-chip text-sm text-faint">{t.image.noImage}</div>
        )}

        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {entries.map(([eid, [x0, y0, x1, y1]]) => {
            const on = rel.entityIds.has(eid);
            const c = entityColor(session.graph, eid);
            return (
              <rect
                key={eid}
                x={x0}
                y={y0}
                width={x1 - x0}
                height={y1 - y0}
                rx={0.012}
                fill={on ? c.solid + '1f' : 'transparent'}
                stroke={c.solid}
                strokeWidth={on ? 3 : 2}
                strokeDasharray={on ? undefined : '7 5'}
                vectorEffect="non-scaling-stroke"
                opacity={hasSelection && !on ? 0.3 : 1}
                style={{ filter: 'drop-shadow(0 1px 2px #fff)', transition: 'opacity .15s' }}
                className="cursor-pointer"
                aria-label={t.image.annotateAria(label(eid))}
                onClick={() => open(eid)}
              >
                <title>{t.image.boxTitle(label(eid))}</title>
              </rect>
            );
          })}
        </svg>

        {/* 标签用 HTML，避免 SVG 文字被拉伸；框贴近顶部时标签放到框内 */}
        {entries.map(([eid, [x0, y0]]) => {
          const on = rel.entityIds.has(eid);
          const c = entityColor(session.graph, eid);
          const inside = y0 < 0.08;
          return (
            <button
              key={eid}
              onClick={() => open(eid)}
              style={{
                left: `calc(${x0 * 100}% + ${inside ? 6 : 0}px)`,
                top: `calc(${y0 * 100}% + ${inside ? 6 : -4}px)`,
                background: c.solid,
                opacity: hasSelection && !on ? 0.3 : 1,
              }}
              className={cn(
                'absolute rounded-full px-2 py-0.5 text-[11px] leading-4 font-bold text-white shadow-[0_2px_6px_#12265233] transition',
                !inside && '-translate-y-full',
              )}
            >
              {label(eid)}
            </button>
          );
        })}

        {/* 已有标注的编号圆章，位于框右上角 */}
        {mine.map((a) => {
          if (!isBox(a.region) || !a.entityId) return null;
          const [, y0, x1] = a.region;
          return (
            <button
              key={a.id}
              onClick={() => open(a.entityId!)}
              title={t.annotate.badgeTitle(a.number, t.annotate.intents[a.intent], a.comment)}
              style={{ left: `min(${x1 * 100}%, 100% - 12px)`, top: `max(${y0 * 100}%, 12px)` }}
              className="absolute z-10 grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-brand text-[11px] font-bold text-white shadow-[0_2px_7px_#1226523d]"
            >
              {a.number}
            </button>
          );
        })}

        {mineChecks.length > 0 && !editing && (
          <span className="pointer-events-none absolute bottom-[11px] left-[11px] flex h-6 items-center gap-1.5 rounded-full border border-white/20 bg-[#0f1d2fb8] px-2.5 text-[11px] font-semibold text-white/95 backdrop-blur">
            <span className="h-[5px] w-[5px] rounded-full bg-[#78e4a6] shadow-[0_0_0_2px_#78e4a633]" />
            {t.image.checked(passed, mineChecks.length)}
          </span>
        )}

        {editing && boxes[editing] && (
          <AnnotationPopover
            key={editing}
            imageId={image.id}
            entityId={editing}
            box={boxes[editing]!}
            label={label(editing)}
            color={entityColor(session.graph, editing).solid}
            existing={mine.find((a) => a.entityId === editing)}
            nextNumber={nextNumber}
          />
        )}
      </div>

      {reqCheck && <p className="mt-2.5 rounded-lg bg-canvas px-2.5 py-2 text-xs leading-relaxed text-ink-3">{reqCheck.reason}</p>}
    </figure>
  );
}
