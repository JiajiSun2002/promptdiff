import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/store/session';
import { IconClose } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { Annotation, AnnotationIntent, Box } from '@/types';
import { INTENTS } from './intents';
import { useT } from '@/i18n';

interface Props {
  imageId: string;
  entityId: string;
  /** 当前显示的边界框，也作为标注区域保存 */
  box: Box;
  label: string;
  color: string;
  existing?: Annotation;
  /** 新建时将得到的编号 */
  nextNumber: number;
}

/** 点击边界框后弹出：选择意图 + 评论 */
export function AnnotationPopover({ imageId, entityId, box, label, color, existing, nextNumber }: Props) {
  const t = useT();
  const upsert = useSession((s) => s.upsertAnnotation);
  const remove = useSession((s) => s.removeAnnotation);
  const close = useSession((s) => s.closeAnnotator);
  const [intent, setIntent] = useState<AnnotationIntent | null>(existing?.intent ?? null);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const ref = useRef<HTMLDivElement>(null);

  // 点面板外部关闭（点另一个框会先关闭再打开新的）
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [close]);

  useEffect(() => {
    const el = ref.current;
    (
      el?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      el?.querySelector<HTMLButtonElement>('[role="radio"]')
    )?.focus();
  }, []);

  const save = () => intent && upsert({ imageId, entityId, region: box, intent, comment });

  // 与原型一致：面板贴在图片内部底角，放在框中心的另一侧，尽量不遮住被标注的对象
  const [x0, , x1] = box;
  const pos: React.CSSProperties = (x0 + x1) / 2 > 0.5 ? { left: 9, bottom: 9 } : { right: 9, bottom: 9 };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t.image.annotateAria(label)}
      style={pos}
      className="absolute z-20 w-64 max-w-[calc(100%-18px)] rounded-[11px] border border-field-line bg-white/97 p-3 text-sm shadow-pop backdrop-blur-md"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
      }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
          {existing?.number ?? nextNumber}
        </span>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <span className="font-bold text-ink-2">{label}</span>
        <span className="text-[11px] text-faint">{existing ? t.annotate.editAnnotation : t.annotate.newAnnotation}</span>
        <button onClick={close} aria-label={t.common.close} className="ml-auto text-[#8d98a9] hover:text-ink-2">
          <IconClose />
        </button>
      </div>

      <div role="radiogroup" aria-label={t.annotate.intentGroup} className="grid grid-cols-2 gap-1.5">
        {INTENTS.map((it) => (
          <button
            key={it.id}
            role="radio"
            aria-checked={intent === it.id}
            onClick={() => setIntent(it.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-bold transition',
              intent === it.id
                ? cn(it.cls, 'shadow-[0_0_0_2px_#fff,0_0_0_3.5px_currentColor]')
                : 'border-[#e3e7ee] bg-chip text-[#53617a] hover:border-[#ccd9fc] hover:bg-brand-soft hover:text-brand',
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              {it.icon}
            </span>
            {t.annotate.intents[it.id]}
          </button>
        ))}
      </div>

      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
        placeholder={t.annotate.commentPlaceholder}
        className="field mt-2 h-8 px-2.5 text-xs"
      />

      <div className="mt-2.5 flex items-center gap-2">
        {existing && (
          <button onClick={() => remove(existing.id)} className="text-xs font-semibold text-bad hover:underline">
            {t.annotate.deleteAnnotation}
          </button>
        )}
        <span className="flex-1" />
        <button onClick={close} className="btn-ghost h-8 px-2.5 text-xs">
          {t.common.cancel}
        </button>
        <button
          onClick={save}
          disabled={!intent}
          title={intent ? t.annotate.saveHint : t.annotate.chooseIntent}
          className="btn h-8 bg-brand px-3 text-xs text-white hover:bg-brand-hover disabled:opacity-40"
        >
          {t.common.save}
        </button>
      </div>
    </div>
  );
}
