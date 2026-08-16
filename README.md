# 夜市攤位爭霸（pg-nightstall）

十二夜短局經營 SLG：看預報進貨、定價、宣傳，和兩名 AI 攤商爭奪客流；季末以現金、庫存與人氣計算淨資產。

## 執行

本遊戲是無 build 的純 HTML／CSS／JavaScript SAM。

```sh
python3 -m http.server 4173
```

開啟 <http://localhost:4173>。

## 測試

```sh
npx vitest run
```

不安裝或提交 `node_modules`。

## 遊戲規則

- 一季 12 夜；每夜先看到天氣與特殊事件。
- 決定進貨量、單價、宣傳力道與是否架雨棚。
- 價格、人氣、天氣、事件與相鄰攤種共同分配客流。
- 季末淨資產＝現金＋半價庫存＋人氣獎勵。
- 最佳淨資產透過 Playgrounds `/api/kv/nightstall:best` 保存；靜態預覽無 API 時仍可正常遊玩。

## 授權

程式碼 MIT。第三方美術、音效、音樂與字型見 [ATTRIBUTION.md](./ATTRIBUTION.md)。
