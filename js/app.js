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
  let lastResult = null;

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
    scoopBox.replaceChildren(...[
      h('p', null, h('strong', { text: 'プロテイン何杯分？' })),
      h('p', null, text, cite(6)),
      h('p', { class: 'hint', text: 'プロテイン1杯（1食分）でタンパク質20gとして計算しています。食事の量は人によって違うので、下の「食べ物でとるなら」の表で、ふだん食べているものと比べてみてください。' }),
      r.gapHigh.gap > 0 ? quickPicks() : null
    ].filter(Boolean));
  }

  // 足りない分があるときだけ、下の「プロテインで足すなら」の先頭2つ（マイプロテインとザバス）を結果のすぐ下にも出す
  function quickPicks() {
    const lists = document.querySelectorAll('#buy .pr-links');
    if (lists.length < 2) return h('p', null, h('a', { href: '#buy', text: 'プロテインを探す' }));
    const pick = (list, cls) => h('ul', { class: cls }, h('li', null, list.querySelector('li a').cloneNode(true)));
    return h('div', { class: 'quick-picks' },
      h('p', null, h('span', { class: 'pr-label', text: 'PR' }), 'プロテインで足すなら'),
      pick(lists[0], 'pr-links'),
      pick(lists[1], 'pr-links pr-items'),
      h('p', { class: 'hint' }, h('a', { href: '#buy', text: 'ほかのプロテインも見る' }))
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
    lastResult = r;
    render(n, r);
    renderMonthly();
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

  // ---- コスパ計算 ----
  const COST_KEY = 'proteincalc:cost:v1';
  const RAKUTEN_ID = '584a279b.2b83ca67.584a279c.b426829b';
  const MYPROTEIN_URL = 'https://click.linksynergy.com/fs-bin/click?id=Pl8Iel207T4&offerid=2050537.7&type=3&subid=0';
  const costForm = document.getElementById('cost-form');
  const costError = document.getElementById('cost-error');
  const productSelect = document.getElementById('cost-product');
  const customFields = document.getElementById('custom-fields');
  const productNote = document.getElementById('product-note');
  const costResult = document.getElementById('cost-result');
  const costBig = document.getElementById('cost-big');
  const costMonth = document.getElementById('cost-month');
  const compareWrap = document.getElementById('compare-wrap');
  const compareBody = document.getElementById('compare-body');
  const yen = x => Math.round(x).toLocaleString('ja-JP');
  let lastCost = null;
  let compare = [];

  // 値段を確かめるリンク（楽天は検索結果、マイプロテインは公式サイト。どちらも紹介リンク）
  function shopLink(p) {
    if (p.shop === 'myprotein') return { href: MYPROTEIN_URL, text: 'マイプロテイン公式サイトで今の値段を見る' };
    const target = 'https://search.rakuten.co.jp/search/mall/' + p.query.split(' ').map(encodeURIComponent).join('+') + '/';
    return { href: 'https://hb.afl.rakuten.co.jp/hgc/' + RAKUTEN_ID + '/?pc=' + encodeURIComponent(target) + '&link_type=text', text: '楽天市場で今の値段を見る' };
  }
  const productById = id => D.products.find(p => p.id === id) || null;

  function setupProducts() {
    productSelect.replaceChildren(
      ...D.products.map(p => h('option', { value: p.id, text: p.name + '（' + p.flavor + '）' })),
      h('option', { value: 'custom', text: 'そのほか（1食の量とタンパク質を入れる）' })
    );
    document.getElementById('product-table').replaceChildren(...D.products.map(p => h('tr', null,
      h('th', { scope: 'row' }, h('a', { href: p.source, rel: 'noopener', text: p.name }), '（' + p.flavor + '）'),
      h('td', { class: 'cell-num', text: p.serving + 'g' }),
      h('td', { class: 'cell-num', text: p.protein + 'g' })
    )));
  }

  function syncProduct(fillSize) {
    const p = productById(productSelect.value);
    customFields.hidden = !!p;
    if (!p) {
      productNote.textContent = '袋の栄養成分表示にある「1食あたり」の量とタンパク質を入れてください。';
      return;
    }
    if (fillSize) costForm.elements.size.value = p.size;
    const link = shopLink(p);
    productNote.replaceChildren(
      '1食' + p.serving + 'gでタンパク質' + p.protein + 'g（メーカーの表示）。',
      h('span', { class: 'pr-label', text: 'PR' }),
      h('a', { href: link.href, target: '_blank', rel: 'nofollow sponsored noopener', text: link.text })
    );
  }

  function readCost() {
    const e = costForm.elements;
    return { product: e.product.value, price: e.price.value, size: e.size.value, serving: e.serving.value, protein: e.protein.value };
  }
  function saveCost() {
    try { localStorage.setItem(COST_KEY, JSON.stringify({ form: readCost(), compare })); } catch (err) { /* 保存できなくても続行 */ }
  }
  function loadCost() {
    try {
      const raw = localStorage.getItem(COST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function renderMonthly() {
    if (!lastCost) return;
    let text;
    if (!lastResult) {
      text = '上で体重と目的を入れて計算すると、足りない分をこのプロテインで足したときの1か月の値段も出します。';
    } else if (lastResult.gapHigh.gap === 0) {
      text = '上の計算では、ふだんの食事だけで足りる量でした。プロテイン代はかからない見込みです。';
    } else {
      const lo = lastResult.gapLow.gap;
      const hi = lastResult.gapHigh.gap;
      const mLo = PC.monthly(lastCost.yenPerGram, lo);
      const mHi = PC.monthly(lastCost.yenPerGram, hi);
      text = lo === 0
        ? '多いほうの目標まで1日約' + hi + 'gをこのプロテインで足すと、1か月（30日）約' + yen(mHi) + '円です。'
        : '足りない分（1日約' + (lo === hi ? lo : lo + '〜' + hi) + 'g）をこのプロテインで足すと、1か月（30日）約' + (mLo === mHi ? yen(mLo) : yen(mLo) + '〜' + yen(mHi)) + '円です。';
    }
    costMonth.textContent = text;
  }

  function renderCompare() {
    compareWrap.hidden = compare.length === 0;
    compareBody.replaceChildren(...compare.slice().sort((a, b) => a.per20 - b.per20).map(c => h('tr', null,
      h('th', { scope: 'row', text: c.name }),
      h('td', { text: yen(c.price) + '円・' + yen(c.size) + 'g' }),
      h('td', { class: 'cell-num', text: '約' + yen(c.per20) + '円' })
    )));
  }

  function calculateCost(scroll) {
    const n = PC.normalizeCost(readCost());
    const errors = PC.validateCost(n);
    if (errors.length) {
      costError.replaceChildren(...errors.map(t => h('span', { class: 'error-line', text: t })));
      costError.hidden = false;
      return false;
    }
    costError.hidden = true;
    const c = PC.cost(n);
    lastCost = c;
    costBig.replaceChildren(
      h('span', { class: 'big-label', text: n.name + ' のタンパク質20gあたり' }),
      h('span', { class: 'big-num', text: '約' + yen(c.per20) + '円' }),
      h('span', { class: 'big-gain', text: '1袋で、タンパク質20gが約' + c.cups + '杯分（タンパク質 約' + yen(c.proteinTotal) + 'g）' })
    );
    renderMonthly();
    const key = [n.product, n.price, n.size, n.serving, n.protein].join('|');
    compare = compare.filter(x => x.key !== key);
    compare.unshift({ key, name: n.name, price: n.price, size: n.size, per20: c.per20 });
    compare = compare.slice(0, 8);
    renderCompare();
    costResult.hidden = false;
    saveCost();
    if (scroll) costResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return true;
  }

  setupProducts();
  costForm.addEventListener('submit', ev => {
    ev.preventDefault();
    calculateCost(true);
  });
  productSelect.addEventListener('change', () => syncProduct(true));
  document.getElementById('compare-clear').addEventListener('click', () => {
    compare = [];
    renderCompare();
    saveCost();
  });

  // ---- 起動時: URL のパラメータ → 前回の入力 の順で復元 ----
  const savedCost = loadCost();
  if (savedCost && typeof savedCost === 'object') {
    if (Array.isArray(savedCost.compare)) compare = savedCost.compare.filter(c => c && c.key && c.per20 > 0).slice(0, 8);
    const f = savedCost.form || {};
    if (productById(f.product) || f.product === 'custom') productSelect.value = f.product;
    ['price', 'size', 'serving', 'protein'].forEach(k => { if (f[k] != null) costForm.elements[k].value = f[k]; });
  }
  syncProduct(!(savedCost && savedCost.form && savedCost.form.size));
  renderCompare();

  const initial = fromParams(location.search) || load();
  applyState(initial);
  if (initial && initial.bw) calculate(false);
  if (savedCost && savedCost.form && savedCost.form.price) {
    calculateCost(false);
  }
})();
