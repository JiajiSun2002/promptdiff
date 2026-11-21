import { create } from 'zustand';
import type { Iteration, Session } from '@/types';
import { removeAnnotation, upsertAnnotation, type AnnotationInput } from '@/lib/annotations';
import { getProvider } from '@/ai';
import { getDemoSession, mockProvider, type DemoId } from '@/ai/mock';

export type Step = 'create' | 'compare' | 'refine';
export type Status = 'idle' | 'extracting' | 'generating' | 'error';

interface SessionState {
  step: Step;
  status: Status;
  error: string | null;
  /** Create 页的输入草稿 */
  srcLang: string;
  srcPrompt: string;
  /** 抽取后才有；生成并检查后 iterations[0] 才有内容 */
  session: Session | null;
  /** 实体 / 属性 / 关系 / 要求 id，驱动联动高亮 */
  selectedId: string | null;

  setStep: (step: Step) => void;
  setSrcLang: (lang: string) => void;
  setSrcPrompt: (prompt: string) => void;
  setEnPrompt: (prompt: string) => void;
  select: (id: string | null) => void;
  loadDemo: (id?: DemoId) => void;
  runExtract: () => Promise<void>;
  runGenerateAndCheck: () => Promise<void>;

  /** 当前打开的标注面板（哪张图的哪个实体） */
  annotating: { imageId: string; entityId: string } | null;
  openAnnotator: (imageId: string, entityId: string) => void;
  closeAnnotator: () => void;
  upsertAnnotation: (input: AnnotationInput) => void;
  removeAnnotation: (id: string) => void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useSession = create<SessionState>((set, get) => ({
  step: 'create',
  status: 'idle',
  error: null,
  srcLang: 'zh',
  srcPrompt: '',
  session: null,
  selectedId: null,

  setStep: (step) => set({ step }),
  setSrcLang: (srcLang) => set({ srcLang }),
  setSrcPrompt: (srcPrompt) => set({ srcPrompt }),
  setEnPrompt: (enPrompt) => {
    const s = get().session;
    if (s) set({ session: { ...s, enPrompt } });
  },
  select: (id) => set((st) => ({ selectedId: st.selectedId === id ? null : id })),

  loadDemo: (id = 'photo') => {
    mockProvider.demo = id;
    const demo = getDemoSession(id);
    set({ srcLang: demo.srcLang, srcPrompt: demo.srcPrompt, session: null, selectedId: null, error: null, annotating: null });
  },

  runExtract: async () => {
    const { srcLang, srcPrompt } = get();
    if (!srcPrompt.trim()) return;
    set({ status: 'extracting', error: null });
    try {
      const r = await (await getProvider()).translateAndExtract(srcLang, srcPrompt);
      const now = new Date().toISOString();
      set({
        status: 'idle',
        selectedId: null,
        session: {
          id: crypto.randomUUID(),
          srcLang,
          srcPrompt,
          enPrompt: r.enPrompt,
          graph: r.graph,
          requirements: r.requirements,
          iterations: [],
          createdAt: now,
        },
      });
    } catch (e) {
      set({ status: 'error', error: errMsg(e) });
    }
  },

  runGenerateAndCheck: async () => {
    const session = get().session;
    if (!session) return;
    set({ status: 'generating', error: null });
    try {
      const provider = await getProvider();
      const images = await provider.generateImages(session, 1);
      // 逐张检查（不并发），降低触发限流的概率
      const checks = [];
      for (const img of images) checks.push(...(await provider.checkImage(session, img)));
      set({
        status: 'idle',
        step: 'compare',
        annotating: null,
        session: {
          ...session,
          iterations: [
            { id: crypto.randomUUID(), images, checks, annotations: [], createdAt: new Date().toISOString() },
          ],
        },
      });
    } catch (e) {
      set({ status: 'error', error: errMsg(e) });
    }
  },

  annotating: null,
  // 打开面板时同时选中该实体（不切换），保持三处联动
  openAnnotator: (imageId, entityId) => set({ annotating: { imageId, entityId }, selectedId: entityId }),
  closeAnnotator: () => set({ annotating: null }),
  upsertAnnotation: (input) => {
    updateCurrentIteration(get, set, (it) => ({ ...it, annotations: upsertAnnotation(it.annotations, input) }));
    set({ annotating: null });
  },
  removeAnnotation: (id) => {
    updateCurrentIteration(get, set, (it) => ({ ...it, annotations: removeAnnotation(it.annotations, id) }));
    set({ annotating: null });
  },
}));

/** 只修改当前迭代（目前是 iterations[0]），保持其他字段不可变 */
function updateCurrentIteration(
  get: () => SessionState,
  set: (p: Partial<SessionState>) => void,
  fn: (it: Iteration) => Iteration,
) {
  const s = get().session;
  const it = s?.iterations[0];
  if (!s || !it) return;
  set({ session: { ...s, iterations: [fn(it), ...s.iterations.slice(1)] } });
}
