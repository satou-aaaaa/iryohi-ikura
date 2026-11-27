// 医療費控除いくら？の問題を作る（ブラウザと node の両方で使う）。
// 中身は、国税庁タックスアンサー No.1120「医療費を支払ったとき（医療費控除）」・No.1122「医療費控除の対象となる医療費」・No.1129「セルフメディケーション税制」に書いてあることだけ（［令和8年4月1日現在法令等］。2026-11-17 に読んだ。要点は共有フォルダ games/iryohi-ikura-research.md）。
// 1問は、1年間（1月1日〜12月31日）に払った医療費の場面を読んで、医療費控除の額を選ぶ。正解したら2段目「どの決まり？」を選ぶ。
// 答えはコードで計算する：対象になる医療費だけを足し、保険金などの補てんは、その医療費を限度に引く（ほかの医療費からは引かない）
//   → 10万円（総所得金額等が200万円未満なら、その5％）を引く → 最高200万円。セルフメディケーション税制は、対象の薬の購入費−12,000円、最高88,000円。
// 対象にならないもの（No.1122）：ビタミン剤など予防・健康増進の薬・健康診断の費用（原則）・バスや電車で行けるのにタクシー・自家用車のガソリン代や駐車場代・家族への付添料・疲れをとるマッサージ・まだ払っていない医療費。
// 所得が書いていない場面は、総所得金額等が200万円以上の人。出産・眼鏡・人間ドックのあとの治療・申告の手続きは扱わない（画面に書く）。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。
// KINDS の並びは最後に足すだけにする（並べ替え・削除をすると過去の日の問題が変わる）。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const AS_OF = "令和8年4月1日現在法令等";

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    a: ["国税庁 タックスアンサー No.1120 医療費を支払ったとき（医療費控除）", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1120.htm"],
    b: ["国税庁 タックスアンサー No.1122 医療費控除の対象となる医療費", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1122.htm"],
    c: ["国税庁 タックスアンサー No.1129 セルフメディケーション税制", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1129.htm"],
  };
  const MEDIA = { a: "1年間に払った医療費" };

  const MAN = 10000, LIMIT = 200 * MAN, SELF_CUT = 12000, SELF_MAX = 88000;
  const thresholdOf = (S) => (S && S < 200 * MAN ? (S * 5) / 100 : 10 * MAN);
  // 対象になる医療費の合計（補てんはその医療費を限度に引く）
  const paidOf = (items) => items.reduce((a, it) => a + (it.ok ? it.amt - Math.min(it.hoten || 0, it.amt) : 0), 0);
  function deductOf(items, S, self) {
    const paid = paidOf(items);
    if (self) return Math.min(Math.max(paid - SELF_CUT, 0), SELF_MAX);
    return Math.min(Math.max(paid - thresholdOf(S), 0), LIMIT);
  }
  function grpOf(items, S, self) {
    if (self) return "self";
    const raw = paidOf(items) - thresholdOf(S);
    if (raw <= 0) return "none";
    if (raw >= LIMIT) return "cap";
    return S && S < 200 * MAN ? "go" : "kiso";
  }

  // 2段目「どの決まり？」
  const GROUPS = {
    kiso: { name: "10万円を引く", sub: "対象の医療費−補てん−10万円", set: "all" },
    go: { name: "所得の5％を引く", sub: "総所得金額等が200万円未満", set: "all" },
    cap: { name: "最高200万円", sub: "計算が200万円以上になる", set: "all" },
    none: { name: "控除なし", sub: "引くと0円以下", set: "all" },
    self: { name: "セルフメディケーション", sub: "購入費−12,000円・最高88,000円", set: "all" },
  };
  const GRP_WHY = {
    kiso: "医療費控除は、対象になる医療費の合計−保険金などの補てん−10万円です。",
    go: "総所得金額等が200万円未満の人は、10万円ではなく総所得金額等の5％を引きます。",
    cap: "医療費控除は、最高200万円です。計算が200万円以上なら200万円です。",
    none: "対象になる医療費から補てんと10万円（または所得の5％）を引いて0円以下なら、医療費控除はありません。",
    self: "セルフメディケーション税制は、対象の薬の購入費−12,000円で、最高88,000円です。ふつうの医療費控除とどちらかを選びます。",
  };
  const KEY = {
    kiso: "対象の医療費−補てん−10万円",
    go: "総所得金額等が200万円未満なら、その5％を引く",
    cap: "医療費控除は最高200万円",
    none: "10万円（または所得の5％）以下なら0円",
    self: "対象の薬の購入費−12,000円、最高88,000円",
  };

  // 種類：[id, 難しさ, 2段目, 場面（＄1〜＄3 が医療費・＊ が補てん・＠ が総所得金額等）, 医療費 [名前, 対象か, 下限, 上限, 刻み], 補てん [何番目の医療費か, 下限, 上限, 刻み, 残す額か] か null, 総所得金額等 [下限, 上限, 刻み] か null, セルフメディケーションか, ヒント1]
  // 補てんの「残す額」が 1 なら、補てん＝その医療費−（下限〜上限）。
  const D = [
    ["k_base", 0, "kiso", "1年に病院の治療費を＄1払った。", [["治療費", 1, 150000, 600000, 10000]], null, null, 0, "10万円を引く。"],
    ["k_two", 0, "kiso", "治療費＄1と、通院のバス代＄2を払った。", [["治療費", 1, 120000, 500000, 10000], ["バス代", 1, 2000, 20000, 1000]], null, null, 0, "通院の電車・バス代は対象。"],
    ["k_med", 0, "kiso", "歯の治療費＄1と、風邪薬＄2を払った。", [["治療費", 1, 120000, 500000, 10000], ["風邪薬", 1, 1000, 8000, 100]], null, null, 0, "治療のための風邪薬は対象。"],
    ["n_small", 0, "none", "1年に払った治療費は＄1だけ。", [["治療費", 1, 10000, 99000, 1000]], null, null, 0, "10万円を引くと？"],
    ["x_vita", 0, "kiso", "治療費＄1と、ビタミン剤＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["ビタミン剤", 0, 3000, 20000, 1000]], null, null, 0, "健康のためのビタミン剤は対象？"],
    ["x_gas", 0, "kiso", "治療費＄1と、通院の車のガソリン代＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["ガソリン代", 0, 3000, 30000, 1000]], null, null, 0, "自家用車のガソリン代は対象？"],
    ["k_wife", 0, "kiso", "生計を一にする妻の治療費＄1を払った。", [["妻の治療費", 1, 150000, 600000, 10000]], null, null, 0, "生計を一にする家族の分も対象。"],
    ["c_cap", 0, "cap", "大きな手術で、治療費＄1を払った。", [["治療費", 1, 2500000, 5000000, 100000]], null, null, 0, "医療費控除の上限は？"],
    ["s_self", 0, "self", "セルフメディケーション税制を選び、対象の薬を＄1買った。", [["対象の薬", 1, 20000, 90000, 1000]], null, null, 1, "12,000円を引く。"],
    ["k_jyu", 0, "kiso", "入院の部屋代・食事代＄1と、治療費＄2を払った。", [["入院の部屋代・食事代", 1, 50000, 200000, 10000], ["治療費", 1, 100000, 400000, 10000]], null, null, 0, "入院の部屋代・食事代も対象。"],
    ["h_kyufu", 1, "kiso", "入院費＄1を払い、保険の入院給付金＊を受けた。", [["入院費", 1, 400000, 900000, 10000]], [0, 50000, 280000, 10000, 0], null, 0, "給付金は医療費から引く。"],
    ["x_taxi", 1, "kiso", "治療費＄1と、バスで行ける病院へのタクシー代＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["タクシー代", 0, 2000, 20000, 1000]], null, null, 0, "バスで行けるのにタクシーなら？"],
    ["x_park", 1, "kiso", "治療費＄1と、通院の駐車場代＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["駐車場代", 0, 2000, 20000, 1000]], null, null, 0, "自家用車の駐車場代は対象？"],
    ["x_kenshin", 1, "kiso", "治療費＄1と、健康診断の費用＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["健康診断の費用", 0, 5000, 50000, 1000]], null, null, 0, "健康診断の費用は、原則として？"],
    ["g_low", 1, "go", "総所得金額等が＠の人が、治療費＄1を払った。", [["治療費", 1, 100000, 300000, 10000]], null, [1000000, 1900000, 100000], 0, "200万円未満なら、10万円でなく？"],
    ["g_none", 1, "none", "総所得金額等が＠の人が、治療費＄1を払った。", [["治療費", 1, 30000, 70000, 1000]], null, [1500000, 1900000, 100000], 0, "所得の5％を引くと？"],
    ["s_low", 1, "self", "セルフメディケーション税制を選び、対象の薬を＄1買った。", [["対象の薬", 1, 3000, 12000, 100]], null, null, 1, "12,000円を引くと？"],
    ["s_cap", 1, "self", "セルフメディケーション税制を選び、対象の薬を＄1買った。", [["対象の薬", 1, 100000, 200000, 1000]], null, null, 1, "セルフメディケーションの上限は？"],
    ["k_edge", 1, "none", "1年に払った治療費は、ちょうど＄1。", [["治療費", 1, 100000, 100000, 1]], null, null, 0, "10万円を引くと？"],
    ["x_tsuki", 1, "kiso", "治療費＄1と、家族に付添料という名目で＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["家族への付添料", 0, 10000, 50000, 1000]], null, null, 0, "家族に払った付添料は対象？"],
    ["x_mas", 1, "kiso", "治療費＄1と、疲れをとるマッサージ代＄2を払った。", [["治療費", 1, 150000, 500000, 10000], ["疲れをとるマッサージ代", 0, 3000, 30000, 1000]], null, null, 0, "疲れをとるためのマッサージは？"],
    ["k_hari", 1, "kiso", "腰痛の治療のはり代＄1と、治療費＄2を払った。", [["はり代", 1, 20000, 100000, 1000], ["治療費", 1, 110000, 300000, 10000]], null, null, 0, "治療のためのはりは対象。"],
    ["h_over", 2, "kiso", "入院費＄1に入院給付金＊。ほかに通院の治療費＄2を払った。", [["入院費", 1, 100000, 300000, 10000], ["通院の治療費", 1, 150000, 500000, 10000]], [0, 400000, 600000, 10000, 0], null, 0, "給付金は、その入院費までしか引かない。"],
    ["h_kogaku", 2, "kiso", "治療費＄1を払い、高額療養費＊が支給された。", [["治療費", 1, 500000, 1500000, 10000]], [0, 100000, 350000, 10000, 0], null, 0, "高額療養費も補てん。"],
    ["g_low2", 2, "go", "総所得金額等が＠の人が、治療費＄1と通院のバス代＄2を払った。", [["治療費", 1, 100000, 300000, 10000], ["バス代", 1, 1000, 10000, 1000]], null, [1000000, 1900000, 100000], 0, "所得の5％を引く。"],
    ["c_edge", 2, "cap", "1年に払った治療費は、ちょうど＄1。", [["治療費", 1, 2100000, 2100000, 1]], null, null, 0, "10万円を引くと、ちょうど上限？"],
    ["c_hoten", 2, "cap", "治療費＄1を払い、保険金＊が出た。", [["治療費", 1, 3000000, 5000000, 100000]], [0, 100000, 800000, 10000, 0], null, 0, "補てんを引いても、上限を超える？"],
    ["x_mix", 2, "kiso", "治療費＄1、ビタミン剤＄2、通院の電車代＄3を払った。", [["治療費", 1, 150000, 500000, 10000], ["ビタミン剤", 0, 3000, 20000, 1000], ["電車代", 1, 1000, 20000, 1000]], null, null, 0, "対象になるものだけを足す。"],
    ["x_mix2", 2, "kiso", "治療費＄1、通院の駐車場代＄2、風邪薬＄3を払った。", [["治療費", 1, 150000, 500000, 10000], ["駐車場代", 0, 2000, 20000, 1000], ["風邪薬", 1, 1000, 8000, 100]], null, null, 0, "対象になるものだけを足す。"],
    ["n_hoten", 2, "none", "治療費＄1を払い、保険金＊を受けた。", [["治療費", 1, 150000, 300000, 10000]], [0, 0, 100000, 10000, 1], null, 0, "補てんを引いてから10万円。"],
    ["x_mibarai", 2, "kiso", "今年の治療費＄1を払った。12月の治療費＄2は翌年1月に払った。", [["治療費", 1, 150000, 500000, 10000], ["翌年に払った治療費", 0, 10000, 100000, 1000]], null, null, 0, "その年に払った医療費だけ。"],
    ["s_vs", 2, "self", "対象の薬を＄1買い、セルフメディケーション税制を選んだ。", [["対象の薬", 1, 13000, 99000, 1]], null, null, 1, "12,000円を引き、88,000円を超えない。"],
    ["g_edge", 2, "go", "総所得金額等が＠の人が、治療費＄1を払った。", [["治療費", 1, 100000, 200000, 1000]], null, [1990000, 1990000, 1], 0, "199万円の5％は？"],
    ["k_family", 2, "kiso", "生計を一にする母の治療費＄1と、自分の治療費＄2を払った。", [["母の治療費", 1, 60000, 300000, 10000], ["自分の治療費", 1, 60000, 300000, 10000]], null, null, 0, "生計を一にする家族の分も足す。"],
    ["x_kenshin2", 2, "kiso", "健康診断の費用＄1、風邪薬＄2、治療費＄3を払った。", [["健康診断の費用", 0, 5000, 50000, 1000], ["風邪薬", 1, 1000, 8000, 100], ["治療費", 1, 150000, 500000, 10000]], null, null, 0, "対象になるものだけを足す。"],
  ];

  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const man = (n) => (n !== 0 && n % MAN === 0 ? `${(n / MAN).toLocaleString("ja-JP")}万円` : yen(n));
  const label = (t) => (t === 0 ? "0円（控除なし）" : yen(t));
  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  const pickAmt = (R, lo, hi, step) => lo + ri(R, 0, Math.floor((hi - lo) / step)) * step;
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end

  function maker(sent, spec, hs, ss, self) {
    return (R) => {
      const items = spec.map(([name, ok, lo, hi, step]) => ({ name, ok: !!ok, amt: pickAmt(R, lo, hi, step) }));
      let hoten = 0;
      if (hs) { const [idx, lo, hi, step, rest] = hs, v = pickAmt(R, lo, hi, step); hoten = rest ? items[idx].amt - v : v; items[idx].hoten = hoten; }
      const S = ss ? pickAmt(R, ss[0], ss[1], ss[2]) : null;
      const ans = deductOf(items, S, self), grp = grpOf(items, S, self);
      let sentence = sent.replace("＊", man(hoten)).replace("＠", man(S || 0));
      items.forEach((it, i) => { sentence = sentence.replace(`＄${i + 1}`, man(it.amt)); });
      // 選び肢：対象外も足した額・補てんを引き忘れた額・補てんをほかの医療費からも引いた額・10万円と5％の取りちがえ・上限なし・何も引かない額から3つ
      const all = items.map((it) => ({ ...it, ok: true })), noH = items.map((it) => ({ ...it, hoten: 0 }));
      const cand = new Set([deductOf(all, S, self), deductOf(noH, S, self)]);
      if (hoten) { const tot = items.reduce((a, it) => a + (it.ok ? it.amt : 0), 0) - hoten; cand.add(Math.min(Math.max(tot - thresholdOf(S), 0), LIMIT)); }
      if (S) cand.add(deductOf(items, null, self));
      if (!S && !self) cand.add(Math.min(Math.max(paidOf(items) - 5 * MAN, 0), LIMIT));
      if (self) { cand.add(Math.max(paidOf(items) - SELF_CUT, 0)); cand.add(Math.min(Math.max(paidOf(items) - 10 * MAN, 0), LIMIT)); cand.add(Math.min(paidOf(items), SELF_MAX)); }
      else { cand.add(Math.max(paidOf(items) - thresholdOf(S), 0)); cand.add(paidOf(items)); }
      const ok = (v) => Number.isInteger(v) && v >= 0 && v !== ans;
      const wrong0 = [...cand].filter(ok);
      const u = ans >= 100000 ? 10000 : 1000;
      for (const kk of [1, -1, 2, -2, 3, 4, 5, 6]) { if (new Set(wrong0).size >= 3) break; const v = ans ? Math.round((ans * (1 + kk / 10)) / u) * u : [10, 20, 5, 30, 40, 50, 60, 70][kk + 2] * 1000; if (ok(v) && !wrong0.includes(v)) wrong0.push(v); }
      const wrong = pickN(R, [...new Set(wrong0)].sort((p, q) => p - q), 3);
      const opts = shuffle(R, [ans, ...wrong]).map(label);
      const paid = paidOf(items), ng = items.filter((it) => !it.ok).map((it) => it.name);
      const full = `${sentence} → 対象の医療費は${yen(paid)}${ng.length ? `（${ng.join("・")}は対象外）` : ""}${hoten ? "（補てんを引いたあと）" : ""}。` + (self ? `${yen(paid)}−12,000円` : `${yen(paid)}−${yen(thresholdOf(S))}`) + `、上限${self ? "88,000円" : "200万円"}で${label(ans)}`;
      return { type: "act", q: `${sentence}　医療費控除は？`, opts, ans: label(ans), rev: false, full, items, hoten, S, self: !!self, paid, deduct: ans, grp, v: items.map((it) => it.amt).join("/") + (hoten ? `-${hoten}` : "") + (S ? `@${S}` : "") };
    };
  }
  const KINDS = D.map(([id, lv, grp, sent, spec, hs, ss, self, look]) => ({ id, lv, grp, col: "a", sent, lo: 0, hi: spec.every((x) => x[2] === x[3]) && !hs ? 0 : 1, look, src: self ? ["a", "c"] : ["a", "b"], name: GROUPS[grp].name + "：" + sent.replace(/＄\d|＊|＠/g, "○円").slice(0, 22) + "…", key: KEY[grp], why: GRP_WHY[grp], make: maker(sent, spec, hs, ss, self) }));
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const GRP_OF = Object.fromEntries(KINDS.map((k) => [k.id, k.grp]));
  const groupsOf = (g) => Object.keys(GROUPS).filter((x) => GROUPS[x].set === GROUPS[g].set);

  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: GRP_WHY[k.grp], media: MEDIA[k.col], src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const IRH = { KINDS, BY, GROUPS, GRP_OF, GRP_WHY, LV, SRC, MEDIA, AS_OF, LIMIT, thresholdOf, paidOf, deductOf, grpOf, kindsOf, groupsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = IRH; else root.IRH = IRH;
})(typeof self !== "undefined" ? self : this);
