import { useSession } from '@/store/session';
import { entityColor } from '@/components/entityColors';
import { langName } from '@/components/shared';
import { IconClose } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Iteration, Session } from '@/types';
import { intentInfo } from './intents';
import { useT } from '@/i18n';

/** 已选标注列表 */
export function AnnotationList({ session, iteration }: { session: Session; iteration: Iteration }) {
  const t = useT();
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const openAnnotator = useSession((s) => s.openAnnotator);
  const remove = useSession((s) => s.removeAnnotation);
  const list = [...iteration.annotations].sort((a, b) => a.number - b.number);

  if (list.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-[13px] text-faint">
        {t.annotate.empty}
      </p>
    );

  const edit = (imageId: string, entityId: string) => {
    openAnnotator(imageId, entityId);
    document.getElementById(`figure-${imageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((a) => {
        const img = iteration.images.find((i) => i.id === a.imageId);
        const ent = session.graph.entities.find((e) => e.id === a.entityId);
        const intent = intentInfo(a.intent);
        const color = a.entityId ? entityColor(session.graph, a.entityId).solid : '#8a95a7';
        return (
          <li
            key={a.id}
            onClick={() => a.entityId && selectedId !== a.entityId && select(a.entityId)}
            className={cn(
              'grid cursor-pointer grid-cols-[26px_1fr_auto] items-center gap-2.5 rounded-lg border border-[#e8ecf3] bg-[#f8fafe] px-2.5 py-2 transition hover:border-brand-line',
              selectedId === a.entityId && 'border-brand-line bg-brand-softer',
            )}
          >
            <b className="grid h-[23px] w-[23px] place-items-center rounded-full bg-brand text-[11px] text-white">
              {a.number}
            </b>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              <span className="flex items-center gap-1.5 font-bold text-ink-3">
                <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                {ent ? `${ent.label.src} · ${ent.label.en}` : (a.entityId ?? t.annotate.region)}
              </span>
              <span className="text-xs text-faint">{t.annotate.imageOf(img ? langName(img.lang, session.srcLang) : '?')}</span>
              <span className={cn('rounded-full border px-2 py-px text-[11px] font-bold', intent.cls)}>
                <span aria-hidden>{intent.icon}</span> {t.annotate.intents[a.intent]}
              </span>
              <span className="min-w-0 truncate text-xs text-[#6b778b]">{a.comment ?? <i className="text-faint">{t.annotate.noComment}</i>}</span>
            </div>
            <span className="flex items-center gap-1">
              {a.entityId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    edit(a.imageId, a.entityId!);
                  }}
                  className="btn-ghost h-7 px-2 text-xs"
                >
                  {t.common.edit}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(a.id);
                }}
                aria-label={t.annotate.deleteAria(a.number)}
                className="grid h-7 w-7 place-items-center rounded-md text-[#8c97a8] hover:bg-bad-soft hover:text-bad"
              >
                <IconClose />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
