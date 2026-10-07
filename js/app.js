/* 1日のタンパク質計算機: 画面の処理（フォーム・描画・保存・共有） */
(function () {
  'use strict';
  const PC = window.PC;
  const D = PC.DATA;

  const STORAGE_KEY = 'proteincalc:v1';
  const GOAL_CODES = { muscle: 'm', cut: 'c', health: 'h' };

  const form = document.getElementById('calc-form');
  const errorBox = document.getElementById('form-error');
  const bfField = document.getElementById('bf-field');
  const resultSection = document.getElementById('result');
  const summaryMeta = document.getElementById('summary-meta');
  const bigRange = document.getElementById('big-range');
  const basisNote = document.getElementById('basis-note');
  const mealLine = document.getElementById('meal-line');
  const scoopBox = document.getElementById('scoop-box');
  const shareBtn = document.getElementById('share-btn');
  const shareBox = document.getElementById('share-box');
  const shareInput = document.getElementById('share-url');
  const shareStatus = document.getElementById('share-status');

  let current = null;

  // ---- 小さな DOM ヘルパー（文字列は必ず textContent として入れる） ----
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false) return;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  const num1 = x => (Math.round(x * 10) / 10).toString();
  const cite = n => h('a', { class: 'cite-chip', href: '#ref-' + n, text: String(n) });
  const range = (a, b, unit) => (a === b ? '約' + a + unit : a + '〜' + b + unit);
  const scoops = g => (g.gap > 0 ? Math.max(0.5, g.scoops) : 0);

  // ---- フォームの状態 ----
  function readForm() {
    const e = form.elements;
    return { bw: e.bw.value, goal: e.goal.value, bf: e.bf.value };
  }

  function syncGoal() {
    bfField.hidden = form.elements.goal.value !== 'cut';
  }

  function applyState(s) {
    if (!s || typeof s !== 'object') return;
    const e = form.elements;
    if (s.bw != null) e.bw.value = s.bw;
    if (s.bf != null) e.bf.value = s.bf;
    if (D.goals[s.goal]) {
      const radio = form.querySelector('input[name="goal"][value="' + s.goal + '"]');
      if (radio) radio.checked = true;
    }
    syncGoal();
  }

  // ---- 保存（使えないブラウザでも動くように try/catch で囲む） ----
  function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* 保存できなくても続行 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---- URL での共有 ----
  function toParams(n) {
    const p = new URLSearchParams();
    p.set('bw', num1(n.bw));
    p.set('g', GOAL_CODES[n.goal]);
    if (n.bf != null) p.set('bf', num1(n.bf));
    return p;
  }
  function fromParams(search) {
    const p = new URLSearchParams(search);
    if (!p.has('bw')) return null;
    const goal = Object.keys(GOAL_CODES).find(k => GOAL_CODES[k] === p.get('g')) || 'muscle';
    return { bw: p.get('bw'), goal, bf: p.get('bf') || '' };
  }
  const baseUrl = () => location.href.split(/[?#]/)[0];
  function updateUrl(n) {
    try { history.replaceState(null, '', '?' + toParams(n).toString()); } catch (e) { /* file:// などで失敗しても続行 */ }
  }

  // ---- 描画 ----
  function render(n, r) {
    summaryMeta.textContent = '体重 ' + num1(n.bw) + 'kg・' + D.goals[n.goal].name + (n.bf != null ? '・体脂肪率 ' + num1(n.bf) + '%' : '');

    let perKg;
    if (r.basis === 'dri') perKg = '体重1kgあたり約' + D.goals.health.perKg + 'g';
    else if (r.basis === 'ffm') perKg = '除脂肪体重 ' + num1(r.ffm) + 'kg × ' + D.goals.cut.ffmLow + '〜' + D.goals.cut.ffmHigh + 'g（体重1kgあたり ' + num1(r.perKgLow) + '〜' + num1(r.perKgHigh) + 'g）';
    else perKg = '体重1kgあたり ' + D.goals[n.goal].low + '〜' + D.goals[n.goal].high + 'g';
    bigRange.replaceChildren(
      h('span', { class: 'big-label', text: '1日の目標' }),
      h('span', { class: 'big-num', text: range(r.low, r.high, 'g') }),
      h('span', { class: 'big-gain', text: perKg })
    );

    let note;
    if (n.goal === 'muscle') note = ['1.6gで筋肉の増え方はほぼ頭打ちになります。2.2gは、効果を取りこぼしたくない人向けの量です。', cite(1)];
    else if (r.basis === 'ffm') note = ['減量中の研究の量で計算しました。食事を大きく減らしているときや、体脂肪が少ないときほど、多いほうの値をめざします。', cite(4)];
    else if (n.goal === 'cut') note = ['体脂肪率がわからないため、筋肉をつけたいときと同じ量で計算しました。体脂肪率を入れると、減量中の研究の量（除脂肪体重1kgあたり2.3〜3.1g）で計算します。', cite(4)];
    else note = ['厚生労働省の食事摂取基準の推奨量の考え方で計算しました。65歳以上なら、1日' + r.senior + 'g（体重1kgあたり' + D.goals.health.seniorPerKg + 'g）以上が目安です。', cite(5)];
    basisNote.replaceChildren(...note);

    mealLine.replaceChildren(
      '1食あたり ', h('strong', { text: range(r.perMealLow, r.perMealHigh, 'g') }), ' を、1日' + r.meals + '回に分けてとります。',
      r.meals === 4 ? cite(3) : cite(2)
    );

    const avg = D.avgIntake.all;
    const lead = 'ふだんの食事が日本人の平均（1日' + avg + 'g）くらいなら、';
    let text;
    if (r.gapHigh.gap === 0) {
      text = lead + '食事だけでとれる量です。プロテインを足す必要はあまりありません。';
    } else if (r.gapLow.gap === 0) {
      text = lead + r.low + 'gには届きます。' + r.high + 'gまで増やすなら、あと約' + r.gapHigh.gap + 'g（プロテイン約' + scoops(r.gapHigh) + '杯分）です。';
    } else if (r.low === r.high) {
      text = lead + '足りない分は約' + r.gapLow.gap + 'g。プロテインなら約' + scoops(r.gapLow) + '杯分です。';
    } else {
      const a = scoops(r.gapLow);
      const b = scoops(r.gapHigh);
      text = lead + '足りない分は約' + r.gapLow.gap + '〜' + r.gapHigh.gap + 'g。プロテインなら約' + (a === b ? a : a + '〜' + b) + '杯分です。';
    }
    scoopBox.replaceChildren(
      h('p', null, h('strong', { text: 'プロテイン何杯分？' })),
      h('p', null, text, cite(6)),
      h('p', { class: 'hint', text: 'プロテイン1杯（1食分）でタンパク質20gとして計算しています。食事の量は人によって違うので、下の「食べ物でとるなら」の表で、ふだん食べているものと比べてみてください。' }),
      r.gapHigh.gap > 0 ? h('p', null, h('a', { href: '#buy', text: 'プロテインを探す' })) : null
    );
  }

  // ---- 計算 ----
  function calculate(scroll) {
    const s = readForm();
    const n = PC.normalizeInput(s);
    const errors = PC.validate(n);
    if (errors.length) {
      errorBox.replaceChildren(...errors.map(t => h('span', { class: 'error-line', text: t })));
      errorBox.hidden = false;
      return false;
    }
    errorBox.hidden = true;
    const r = PC.calc(n);
    current = n;
    render(n, r);
    resultSection.hidden = false;
    shareBox.hidden = true;
    save(s);
    updateUrl(n);
    if (scroll) resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    calculate(true);
  });
  form.addEventListener('change', ev => { if (ev.target.name === 'goal') syncGoal(); });

  shareBtn.addEventListener('click', async () => {
    if (!current) return;
    const url = baseUrl() + '?' + toParams(current).toString();
    shareInput.value = url;
    shareBox.hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = 'リンクをコピーしました。開くと同じ結果が表示されます。';
    } catch (err) {
      shareInput.focus();
      shareInput.select();
      shareStatus.textContent = 'リンクを選択しました。コピーして共有してください。';
    }
  });

  // ---- 起動時: URL のパラメータ → 前回の入力 の順で復元 ----
  const initial = fromParams(location.search) || load();
  applyState(initial);
  if (initial && initial.bw) calculate(false);
})();
