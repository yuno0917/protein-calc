/* 1日のタンパク質計算機: データと計算（DOM に触れない純粋な関数） */
(function (root) {
  'use strict';
  const PC = root.PC = root.PC || {};

  const DATA = {
    goals: {
      // 筋肉をつけたい: Morton 2018 の折れ点 1.62（95%CI 1.03〜2.20）g/kg/日。多めにとるなら 2.2
      muscle: { name: '筋肉をつけたい', low: 1.6, high: 2.2, meals: 4 },
      // 減量中: 体脂肪率がわかれば Helms 2014 の除脂肪体重1kgあたり 2.3〜3.1g。わからなければ筋肉をつけたいときと同じ幅
      cut: { name: '減量中', low: 1.6, high: 2.2, ffmLow: 2.3, ffmHigh: 3.1, meals: 4 },
      // 健康のため: 食事摂取基準2025 の考え方（必要量 約0.73g/kg × 1.25）。65歳以上は 1.2g/kg 以上
      health: { name: '健康のため', perKg: 0.9, seniorPerKg: 1.2, meals: 3 }
    },
    // 令和6年国民健康・栄養調査（20歳以上の平均、g/日）
    avgIntake: { all: 71.5, male: 78.0, female: 65.9 },
    // プロテイン1杯（1食分）のタンパク質（g）。ザバス ホエイプロテイン100 は28gで20.0g
    scoop: 20,
    // 日本食品標準成分表（八訂）増補2023年のたんぱく質（g/100g）と、目安の量（g）
    foods: [
      { name: '鶏むね肉（皮なし）', amount: '100g', grams: 100, per100: 23.3 },
      { name: '鶏ささみ', amount: '1本（50g）', grams: 50, per100: 23.9 },
      { name: '鮭（しろさけ）', amount: '1切れ（80g）', grams: 80, per100: 22.3 },
      { name: 'ツナ缶（水煮）', amount: '1缶（70g）', grams: 70, per100: 16.0 },
      { name: '卵', amount: '1個（50g）', grams: 50, per100: 12.2 },
      { name: '木綿豆腐', amount: '半丁（150g）', grams: 150, per100: 7.0 },
      { name: '納豆', amount: '1パック（45g）', grams: 45, per100: 16.5 },
      { name: '牛乳', amount: 'コップ1杯（200g）', grams: 200, per100: 3.3 },
      { name: 'ヨーグルト（無糖）', amount: '100g', grams: 100, per100: 3.6 },
      { name: '食パン', amount: '6枚切り1枚（60g）', grams: 60, per100: 8.9 },
      { name: 'ごはん', amount: '茶碗1杯（150g）', grams: 150, per100: 2.5 }
    ]
  };

  // コスパ計算に使う商品。1食の量とタンパク質はメーカー公式の栄養成分表示（2026年10月7日に確認）。
  // 味によってタンパク質が違う商品は、味を書いておく。size はよくある内容量（値段は入れてもらう）
  DATA.products = [
    { id: 'savas-whey', name: 'ザバス ホエイプロテイン100', flavor: 'リッチショコラ味', serving: 28, protein: 19.5, size: 800, shop: 'rakuten', query: 'ザバス ホエイプロテイン100', source: 'https://www.meiji.co.jp/products/sports/4902777302102.html' },
    { id: 'savas-soy', name: 'ザバス ソイプロテイン100', flavor: 'ココア味', serving: 28, protein: 20.0, size: 900, shop: 'rakuten', query: 'ザバス ソイプロテイン100', source: 'https://www.meiji.co.jp/products/sports/4902777308388.html' },
    { id: 'mp-impact-choc', name: 'マイプロテイン Impact ホエイ', flavor: 'ナチュラルチョコレート味', serving: 30, protein: 21, size: 900, shop: 'myprotein', source: 'https://www.myprotein.jp/p/sports-nutrition/impact-whey-protein-powder/10530943/?variation=17712292' },
    { id: 'mp-impact-plain', name: 'マイプロテイン Impact ホエイ', flavor: 'ノンフレーバー', serving: 30, protein: 23, size: 1000, shop: 'myprotein', source: 'https://www.myprotein.jp/p/sports-nutrition/impact-whey-protein-powder/10530943/?variation=10531012' },
    { id: 'belegend', name: 'ビーレジェンド WPC', flavor: '激うまチョコ風味', serving: 30, protein: 20.9, size: 900, shop: 'rakuten', query: 'ビーレジェンド ホエイ', source: 'https://store.belegend.jp/item/BLWP02AP1.html' },
    { id: 'grong', name: 'GronG ホエイプロテイン100 スタンダード', flavor: 'ココア風味', serving: 29, protein: 21.9, size: 1000, shop: 'rakuten', query: 'GronG ホエイプロテイン100', source: 'https://shop.grong.jp/products/whey-protein-standard' },
    { id: 'on-gold', name: 'ゴールドスタンダード 100% ホエイ', flavor: 'ダブルリッチチョコレート', serving: 31, protein: 24, size: 898, shop: 'rakuten', query: 'ゴールドスタンダード ホエイ', source: 'https://www.optimumnutrition.com/ja-jp/products/gold-standard-100-whey-protein-powder' },
    { id: 'dns', name: 'DNS プロテインホエイ100', flavor: 'プレミアムチョコレート風味', serving: 35, protein: 24.2, size: 1000, shop: 'rakuten', query: 'DNS プロテインホエイ100', source: 'https://shop.dnszone.jp/shop/g/gD23001110105/' },
    { id: 'xplosion', name: 'エクスプロージョン WPC', flavor: 'ミルクチョコレート味', serving: 30, protein: 21.0, size: 3000, shop: 'rakuten', query: 'エクスプロージョン WPC', source: 'https://store.x-plosion.jp/view/page/ingredients' }
  ];

  const r1 = x => Math.round(x * 10) / 10;
  const half = x => Math.round(x * 2) / 2;

  function foodList() {
    return DATA.foods.map(f => Object.assign({}, f, { protein: r1(f.grams * f.per100 / 100) }));
  }

  // ふだんの食事が平均くらいのとき、足りない分とプロテインの杯数。
  // 差が5g未満なら、食事でとれる量とみなす（卵1個にも満たない差のため）
  function gapFor(grams) {
    const raw = grams - DATA.avgIntake.all;
    const gap = raw < 5 ? 0 : raw;
    return { gap: Math.round(gap), scoops: half(gap / DATA.scoop) };
  }

  // n: { bw, goal, bf }（bf は減量中のときだけ、なければ null）
  function calc(n) {
    const g = DATA.goals[n.goal];
    let low, high, basis, ffm = null;
    if (n.goal === 'health') {
      low = high = n.bw * g.perKg;
      basis = 'dri';
    } else if (n.goal === 'cut' && n.bf != null) {
      ffm = n.bw * (1 - n.bf / 100);
      low = ffm * g.ffmLow;
      high = ffm * g.ffmHigh;
      basis = 'ffm';
    } else {
      low = n.bw * g.low;
      high = n.bw * g.high;
      basis = 'bw';
    }
    const lowG = Math.round(low);
    const highG = Math.round(high);
    return {
      goal: n.goal, bw: n.bw, bf: n.bf, basis,
      ffm: ffm == null ? null : r1(ffm),
      low: lowG, high: highG,
      perKgLow: r1(lowG / n.bw), perKgHigh: r1(highG / n.bw),
      meals: g.meals,
      perMealLow: Math.round(lowG / g.meals), perMealHigh: Math.round(highG / g.meals),
      senior: n.goal === 'health' ? Math.round(n.bw * g.seniorPerKg) : null,
      gapLow: gapFor(lowG), gapHigh: gapFor(highG)
    };
  }

  function normalizeInput(input) {
    const i = input || {};
    const num = v => (v === '' || v == null ? NaN : Number(v));
    const goal = DATA.goals[i.goal] ? i.goal : 'muscle';
    const bf = num(i.bf);
    return { bw: num(i.bw), goal, bf: goal === 'cut' && bf > 0 ? bf : null };
  }

  function validate(n) {
    const errors = [];
    if (!(n.bw >= 30 && n.bw <= 200)) errors.push('体重を30〜200kgの範囲で入れてください。');
    if (n.bf != null && !(n.bf >= 3 && n.bf <= 60)) errors.push('体脂肪率は3〜60%の範囲で入れてください（わからなければ空のままで大丈夫です）。');
    return errors;
  }

  // ---- コスパ計算 ----
  // 値段（円）・内容量（g）・1食の量（g）・1食のタンパク質（g）から、
  // 1袋のタンパク質の合計、タンパク質20gあたりの値段、20gを1杯とした杯数を出す
  function cost(n) {
    const proteinTotal = n.size / n.serving * n.protein;
    const yenPerGram = n.price / proteinTotal;
    return {
      proteinTotal: Math.round(proteinTotal),
      yenPerGram,
      per20: Math.round(yenPerGram * DATA.scoop),
      cups: Math.round(proteinTotal / DATA.scoop)
    };
  }

  // 1日 grams g をこのプロテインでとるときの、30日分の値段（10円単位）
  function monthly(yenPerGram, grams) {
    return Math.round(yenPerGram * grams * 30 / 10) * 10;
  }

  function normalizeCost(input) {
    const i = input || {};
    const num = v => (v === '' || v == null ? NaN : Number(v));
    const p = DATA.products.find(x => x.id === i.product) || null;
    return {
      product: p ? p.id : 'custom',
      name: p ? p.name + '（' + p.flavor + '）' : 'そのほかの商品',
      price: num(i.price),
      size: num(i.size),
      serving: p ? p.serving : num(i.serving),
      protein: p ? p.protein : num(i.protein)
    };
  }

  function validateCost(n) {
    const errors = [];
    if (!(n.price >= 1 && n.price <= 100000)) errors.push('値段を1〜100,000円の範囲で入れてください。');
    if (!(n.size >= 10 && n.size <= 10000)) errors.push('内容量を10〜10,000gの範囲で入れてください。');
    if (!(n.serving >= 1 && n.serving <= 200)) errors.push('1食の量を1〜200gの範囲で入れてください。');
    if (!(n.protein > 0 && n.protein <= n.serving)) errors.push('1食のタンパク質を、1食の量より少なく入れてください。');
    return errors;
  }

  Object.assign(PC, { DATA, foodList, gapFor, calc, normalizeInput, validate, cost, monthly, normalizeCost, validateCost });
})(typeof window !== 'undefined' ? window : globalThis);
