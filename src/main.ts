import './base.css';
import './style.css';
import { h, toast, uid, langToggle, icon, showSaveBanner, hideSaveBanner, confirmDialog } from './ui';
import { initDb, loadState, saveState } from './db';
import { dicts, type Lang, type Dict } from './i18n';
import { ruleMatches, addDays, todayDate, type Kind, type Rule } from './rules';

interface Cat { id: string; emoji: string; ja: string; en: string }
interface Form { categoryId: string; kind: Kind; weekday: number; dates: string[] }
interface Custom { emoji: string; ja: string; en: string }
interface State {
  lang: Lang;
  categories: Cat[];
  rules: Rule[];
  form: Form;
  custom: Custom;
}

const DEFAULTS: Cat[] = [
  { id: 'burn', emoji: '🔥', ja: '燃やせるごみ', en: 'Burnable' },
  { id: 'plastic', emoji: '♻️', ja: 'プラ', en: 'Plastic' },
  { id: 'cans', emoji: '🥫', ja: '瓶・缶', en: 'Bottles & cans' },
  { id: 'paper', emoji: '📰', ja: '紙', en: 'Paper' },
  { id: 'bulky', emoji: '🪑', ja: '粗大ごみ', en: 'Bulky waste' },
];

function fresh(): State {
  return {
    lang: 'ja',
    categories: DEFAULTS.map((c) => ({ ...c })),
    rules: [],
    form: { categoryId: 'burn', kind: 'weekly', weekday: 1, dates: [] },
    custom: { emoji: '', ja: '', en: '' },
  };
}

function isKind(v: unknown): v is Kind {
  return v === 'weekly' || v === 'nth' || v === 'dates';
}

function sanitize(s: State): State {
  const base = fresh();
  const categories: Cat[] = Array.isArray(s.categories)
    ? s.categories.filter((c) => c && typeof c.id === 'string').map((c) => ({
      id: c.id,
      emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji : '🗑️',
      ja: typeof c.ja === 'string' ? c.ja : '',
      en: typeof c.en === 'string' ? c.en : '',
    })).filter((c) => c.ja || c.en)
    : [];
  const cats = categories.length ? categories : base.categories;
  const ids = new Set(cats.map((c) => c.id));
  const rules: Rule[] = Array.isArray(s.rules)
    ? s.rules.filter((r) => r && typeof r.id === 'string' && typeof r.categoryId === 'string' && ids.has(r.categoryId) && isKind(r.kind)).map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      kind: r.kind,
      weekday: Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6 ? r.weekday : 0,
      dates: Array.isArray(r.dates) ? r.dates.filter((d) => typeof d === 'string') : [],
    }))
    : [];
  const form = s.form && isKind(s.form.kind) ? s.form : base.form;
  const categoryId = ids.has(form.categoryId) ? form.categoryId : cats[0].id;
  return {
    lang: s.lang === 'en' ? 'en' : 'ja',
    categories: cats,
    rules,
    form: {
      categoryId,
      kind: isKind(form.kind) ? form.kind : 'weekly',
      weekday: Number.isInteger(form.weekday) && form.weekday >= 0 && form.weekday <= 6 ? form.weekday : 1,
      dates: Array.isArray(form.dates) ? form.dates.filter((d) => typeof d === 'string') : [],
    },
    custom: {
      emoji: typeof s.custom?.emoji === 'string' ? s.custom.emoji : '',
      ja: typeof s.custom?.ja === 'string' ? s.custom.ja : '',
      en: typeof s.custom?.en === 'string' ? s.custom.en : '',
    },
  };
}

let state = fresh();
let t: Dict = dicts.ja;
const app = document.getElementById('app')!;
let saveTimer = 0;

async function persist(): Promise<void> {
  const ok = await saveState(state);
  if (ok) hideSaveBanner();
  else showSaveBanner();
}
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { void persist(); }, 250);
}
function setLang(l: Lang) {
  state.lang = l;
  t = dicts[l];
  document.documentElement.lang = l;
  document.title = t.app;
  void persist();
  render();
}

function catName(c: Cat): string {
  if (state.lang === 'ja') return c.ja || c.en;
  return c.en || c.ja;
}
function catById(id: string): Cat | undefined {
  return state.categories.find((c) => c.id === id);
}
function catsOn(date: Date): Cat[] {
  const seen = new Set<string>();
  const out: Cat[] = [];
  for (const rule of state.rules) {
    if (!ruleMatches(rule, date) || seen.has(rule.categoryId)) continue;
    const c = catById(rule.categoryId);
    if (!c) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
function pills(list: Cat[], empty: string) {
  if (!list.length) return h('span', { class: 'muted' }, empty);
  return h('div', { class: 'pills' }, ...list.map((c) => h('span', { class: 'pill' }, `${c.emoji} ${catName(c)}`)));
}
function fmt(d: Date): string {
  return d.toLocaleDateString(state.lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}
function ruleText(r: Rule): string {
  const c = catById(r.categoryId);
  const name = c ? `${c.emoji} ${catName(c)}` : '';
  if (r.kind === 'dates') return `${t.dates} · ${(r.dates.join(', ') || '—')} · ${name}`;
  const wd = t.wd[r.weekday] ?? '';
  const when = r.kind === 'weekly' ? t.weekly : t.nth;
  return `${when} ${wd} · ${name}`;
}

async function deleteRule(r: Rule) {
  const ok = await confirmDialog(t.confirmDel, ruleText(r), t.del, t.cancel, true);
  if (!ok) return;
  const idx = state.rules.findIndex((x) => x.id === r.id);
  if (idx < 0) return;
  state.rules.splice(idx, 1);
  render();
  void persist();
  toast(t.deleted, {
    label: t.undo,
    run: () => {
      if (!state.rules.some((x) => x.id === r.id)) state.rules.splice(Math.min(idx, state.rules.length), 0, r);
      render();
      void persist();
    },
  });
}

async function deleteCat(c: Cat) {
  const ok = await confirmDialog(t.del, t.confirmCat, t.del, t.cancel, true);
  if (!ok) return;
  const removedRules = state.rules.filter((r) => r.categoryId === c.id);
  state.categories = state.categories.filter((x) => x.id !== c.id);
  state.rules = state.rules.filter((r) => r.categoryId !== c.id);
  if (!state.categories.some((x) => x.id === state.form.categoryId)) {
    state.form.categoryId = state.categories[0]?.id ?? '';
  }
  render();
  void persist();
  toast(t.deleted, {
    label: t.undo,
    run: () => {
      if (!state.categories.some((x) => x.id === c.id)) state.categories.push(c);
      for (const r of removedRules) {
        if (!state.rules.some((x) => x.id === r.id)) state.rules.push(r);
      }
      render();
      void persist();
    },
  });
}

function addRule() {
  if (!state.form.categoryId || !catById(state.form.categoryId)) {
    toast(t.needName);
    return;
  }
  if (state.form.kind === 'dates' && state.form.dates.length === 0) {
    toast(t.needDate);
    return;
  }
  state.rules.push({
    id: uid(),
    categoryId: state.form.categoryId,
    kind: state.form.kind,
    weekday: state.form.weekday,
    dates: [...state.form.dates],
  });
  state.form.dates = [];
  render();
  void persist();
}

function addCategory() {
  const ja = state.custom.ja.trim();
  const en = state.custom.en.trim();
  if (!ja && !en) {
    toast(t.needName);
    return;
  }
  const cat: Cat = {
    id: uid(),
    emoji: (state.custom.emoji.trim() || '🗑️').slice(0, 8),
    ja: ja || en,
    en: en || ja,
  };
  state.categories.push(cat);
  state.custom = { emoji: '', ja: '', en: '' };
  if (!state.form.categoryId) state.form.categoryId = cat.id;
  render();
  void persist();
}

function render() {
  t = dicts[state.lang];
  const today = todayDate();
  const hasRules = state.rules.length > 0;

  const select = h('select', { class: 'input', 'aria-label': t.category },
    ...state.categories.map((c) => h('option', { value: c.id, selected: c.id === state.form.categoryId }, `${c.emoji} ${catName(c)}`)),
  );
  select.addEventListener('change', () => {
    state.form.categoryId = select.value;
    persistSoon();
  });

  const kinds: { id: Kind; label: string }[] = [
    { id: 'weekly', label: t.weekly },
    { id: 'nth', label: t.nth },
    { id: 'dates', label: t.dates },
  ];
  const kindChips = h('div', { class: 'chips' }, ...kinds.map((k) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(state.form.kind === k.id) }, k.label);
    b.addEventListener('click', () => {
      state.form.kind = k.id;
      void persist();
      render();
    });
    return b;
  }));

  const wdChips = h('div', { class: 'chips', role: 'group', 'aria-label': t.weekday }, ...t.wd.map((label, i) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(state.form.weekday === i) }, label);
    b.addEventListener('click', () => {
      state.form.weekday = i;
      void persist();
      render();
    });
    return b;
  }));

  const dateInput = h('input', { class: 'input', type: 'date', 'aria-label': t.pickDate });
  const dateBtn = h('button', { class: 'btn', type: 'button' }, t.addDate);
  dateBtn.addEventListener('click', () => {
    const v = dateInput.value;
    if (!v) {
      toast(t.needDate);
      return;
    }
    if (!state.form.dates.includes(v)) state.form.dates.push(v);
    void persist();
    render();
  });

  const emoji = h('input', { class: 'input emoji-input', value: state.custom.emoji, placeholder: '🗑️', 'aria-label': t.emoji, maxlength: '8' });
  const nameJa = h('input', { class: 'input', value: state.custom.ja, placeholder: '古着', 'aria-label': t.nameJa });
  const nameEn = h('input', { class: 'input', value: state.custom.en, placeholder: t.customPh, 'aria-label': t.nameEn });
  emoji.addEventListener('input', () => { state.custom.emoji = emoji.value; persistSoon(); });
  nameJa.addEventListener('input', () => { state.custom.ja = nameJa.value; persistSoon(); });
  nameEn.addEventListener('input', () => { state.custom.en = nameEn.value; persistSoon(); });

  const hero = hasRules
    ? h('section', { class: 'today' },
      h('p', { class: 'kicker' }, t.today),
      h('div', { class: 'bigdate' }, fmt(today)),
      pills(catsOn(today), t.none),
    )
    : h('section', { class: 'today' },
      h('p', { class: 'kicker' }, fmt(today)),
      h('div', { class: 'bigdate' }, t.emptyTitle),
      h('p', { class: 'muted', style: 'margin:0' }, t.emptyBody),
    );

  const upcoming = hasRules
    ? h('section', {},
      h('h2', { class: 'sec' }, t.next),
      h('div', { class: 'days' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => {
        const d = addDays(today, n);
        return h('div', { class: 'day' }, h('time', {}, fmt(d)), pills(catsOn(d), t.none));
      })),
    )
    : null;

  const ruleList = state.rules.length
    ? h('div', { class: 'days' }, ...state.rules.map((r) => {
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.del }, icon('trash'));
      del.addEventListener('click', () => { void deleteRule(r); });
      return h('div', { class: 'rule' }, h('div', { class: 'rule-main' }, h('strong', {}, ruleText(r))), del);
    }))
    : h('p', { class: 'empty' }, t.noRules);

  const catList = h('div', { class: 'days' }, ...state.categories.map((c) => {
    const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.del }, icon('trash'));
    del.addEventListener('click', () => { void deleteCat(c); });
    return h('div', { class: 'cat' },
      h('div', { class: 'cat-main' }, h('strong', {}, `${c.emoji} ${catName(c)}`), h('span', { class: 'muted small' }, state.lang === 'ja' ? c.en : c.ja)),
      del,
    );
  }));

  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('h1', {}, t.app),
      langToggle(state.lang, setLang),
    ),
    h('main', {},
      hero,
      upcoming,
      h('h2', { class: 'sec' }, t.rules),
      ruleList,
      h('section', { class: 'card' },
        h('h2', { class: 'sec', style: 'margin-top:0' }, t.addRule),
        h('label', { class: 'field' }, t.category, select),
        kindChips,
        state.form.kind === 'dates'
          ? h('div', {},
            h('div', { class: 'row' }, dateInput, dateBtn),
            h('div', { class: 'dates' }, ...state.form.dates.map((d) => {
              const b = h('button', { class: 'btn', type: 'button', 'aria-label': t.removeDate }, d);
              b.addEventListener('click', () => {
                state.form.dates = state.form.dates.filter((x) => x !== d);
                void persist();
                render();
              });
              return b;
            })),
          )
          : h('div', {},
            h('span', { class: 'set-label' }, t.weekday),
            wdChips,
            state.form.kind === 'nth' ? h('p', { class: 'muted small' }, t.nthHint) : null,
          ),
        h('button', { class: 'btn primary block', type: 'button', onclick: addRule }, t.addRule),
      ),
      h('h2', { class: 'sec' }, t.categories),
      catList,
      h('section', { class: 'card' },
        h('h2', { class: 'sec', style: 'margin-top:0' }, t.addCat),
        h('div', { class: 'row' }, emoji, h('div', { class: 'grow' }, nameJa)),
        nameEn,
        h('button', { class: 'btn block', type: 'button', onclick: addCategory }, t.addCat),
      ),
      h('p', { class: 'foot' }, t.privacy),
    ),
  );
}

async function boot() {
  const ok = await initDb('gomi-touban');
  if (!ok) showSaveBanner();
  state = sanitize(await loadState(fresh()));
  t = dicts[state.lang];
  document.documentElement.lang = state.lang;
  document.title = t.app;
  render();
  window.addEventListener('pagehide', () => { void persist(); });
}
void boot();
