# ごみ当番（Gomi Touban）

ごみの日を自分で登録するカレンダー PWA。**無料・広告なし・ログイン不要・オフライン対応。**

## できること

- 種類: 燃やせるごみ、プラ、瓶・缶、紙、粗大ごみ。絵文字と日英の名前で追加もできる
- ルール: 毎週、第1・第3（その曜日の1回目と3回目）、または特定の日付
- 今日と、その先14日に何を出すか
- ルールが無いときは「ルールを足してください」。市区町村のカレンダーは取得しません

データはこの端末の IndexedDB だけです。収集日の正解は自治体の案内を見てください。

## English

**Gomi Touban** is a personal trash-day calendar. You enter the rules yourself — the app does not fetch your city’s schedule. Categories start with burnable, plastic, bottles & cans, paper, and bulky waste, and you can add your own (emoji + Japanese and English names). A rule is a weekday every week, the 1st and 3rd time that weekday falls in the month, or specific dates. Home shows today and the next 14 days. With no rules, it asks you to add one. Free, no ads, no login, offline. Stored in IndexedDB on this device.

## 開発 / Development

```bash
npm install
npm run dev
npm run build
```

Vite + vanilla TypeScript + vite-plugin-pwa（`registerType: 'autoUpdate'`, `base: './'`）。
