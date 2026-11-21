import { Fragment } from 'react';
import { useSession } from '@/store/session';
import type { Related } from '@/lib/graph';
import { effectiveVerdict, isLanguageGap } from '@/lib/diff';
import { VerdictBadge, langName } from '@/components/shared';
import { cn } from '@/lib/utils';
import type { Check, DiffCategory, GeneratedImage, RequirementDiff, Session } from '@/types';
import { useT, type Dict } from '@/i18n';

interface Props {
  session: Session;
  images: GeneratedImage[];
  checks: Check[];
  diffs: Record<string, RequirementDiff>;
  rel: Related;
}

export function diffLabel(cat: DiffCategory, srcName: string, t: Dict): { icon: string; text: string } {
  switch (cat) {
    case 'both_pass':
      return { icon: '✓', text: t.matrix.cat.bothPass };
    case 'both_fail':
      return { icon: '✗', text: t.matrix.cat.bothFail };
    case 'src_only_fail':
      return { icon: '⚠', text: t.matrix.cat.srcOnly(srcName) };
    case 'en_only_fail':
      return { icon: '⚠', text: t.matrix.cat.enOnly };
    case 'uncertain':
      return { icon: '?', text: t.matrix.cat.uncertain };
  }
}

export function CheckMatrix({ session, images, checks, diffs, rel }: Props) {
  const t = useT();
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const srcName = langName('src', session.srcLang);
  // 列按语言分组：源语言在前，English 在后
  const cols = [...images].sort((a, b) => (a.lang === b.lang ? a.sampleIndex - b.sampleIndex : a.lang === 'src' ? -1 : 1));
  const find = (imageId: string, reqId: string) => checks.find((c) => c.imageId === imageId && c.requirementId === reqId);

  const diffPill: Record<DiffCategory, string> = {
    both_pass: 'bg-ok-soft text-ok',
    both_fail: 'bg-bad-soft text-bad',
    src_only_fail: 'bg-warn text-white',
    en_only_fail: 'bg-warn text-white',
    uncertain: 'bg-warn-soft text-warn',
  };
  const kindTag: Record<string, string> = {
    entity: 'bg-brand-soft text-brand',
    attribute: 'bg-chip text-[#53617a]',
    relation: 'bg-rel-soft text-rel',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line-soft bg-canvas/60 text-left text-[11px] font-bold tracking-wide text-faint uppercase">
            <th className="w-1 p-0" />
            <th className="py-2.5 pr-2 pl-3 font-bold">#</th>
            <th className="py-2.5 pr-3 font-bold">{t.matrix.requirement}</th>
            {cols.map((img) => (
              <th key={img.id} className="py-2.5 pr-3 font-bold whitespace-nowrap normal-case">
                {langName(img.lang, session.srcLang)}
                {images.filter((i) => i.lang === img.lang).length > 1 && ` #${img.sampleIndex + 1}`}
              </th>
            ))}
            <th className="py-2.5 pr-4 font-bold">{t.matrix.diff}</th>
          </tr>
        </thead>
        <tbody>
          {session.requirements.map((req) => {
            const d = diffs[req.id];
            const gap = d != null && isLanguageGap(d.category);
            const linked = rel.requirementIds.has(req.id);
            const selected = selectedId === req.id;
            const dl = d && diffLabel(d.category, srcName, t);
            return (
              <Fragment key={req.id}>
                <tr
                  onClick={() => select(req.id)}
                  aria-selected={selected}
                  className={cn(
                    'cursor-pointer border-b border-line-soft transition hover:bg-[#fafbfe]',
                    gap && 'bg-warn-soft/60 hover:bg-warn-soft',
                    linked && 'bg-brand-softer outline-2 -outline-offset-2 outline-brand/60 hover:bg-brand-softer',
                    rel.requirementIds.size > 0 && !linked && 'opacity-45',
                  )}
                >
                  <td className={cn('w-1 p-0', gap && 'bg-warn')} />
                  <td className="py-2 pr-2 pl-3 text-xs font-semibold text-faint">{req.id}</td>
                  <td className="py-2 pr-3 text-ink-2">
                    <span className={cn('mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold', kindTag[req.kind])}>
                      {t.kinds[req.kind]}
                    </span>
                    {req.question}
                  </td>
                  {cols.map((img) => {
                    const c = find(img.id, req.id);
                    return (
                      <td key={img.id} className="py-2 pr-3 whitespace-nowrap">
                        {c ? (
                          <>
                            <VerdictBadge verdict={effectiveVerdict(c)} title={c.reason} />
                            {c.userOverride && (
                              <span className="ml-1 text-[10px] text-faint" title={t.matrix.modelVerdict(c.verdict)}>
                                {t.matrix.overridden}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-line">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {dl && d && (
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', diffPill[d.category])}>
                        <span aria-hidden>{dl.icon}</span>
                        {dl.text}
                      </span>
                    )}
                  </td>
                </tr>
                {selected && (
                  <tr className="border-b border-line-soft bg-brand-softer">
                    <td className="p-0" />
                    <td />
                    <td colSpan={cols.length + 2} className="pt-0 pr-4 pb-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {cols.map((img) => {
                          const c = find(img.id, req.id);
                          return (
                            <div key={img.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs leading-relaxed text-ink-3">
                              <b className="mr-1 text-ink-2">{langName(img.lang, session.srcLang)}</b>
                              {c?.reason ?? t.matrix.noResult}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
