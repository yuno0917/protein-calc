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

  Object.assign(PC, { DATA, foodList, gapFor, calc, normalizeInput, validate });
})(typeof window !== 'undefined' ? window : globalThis);
