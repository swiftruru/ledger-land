// Lighthouse 的網址分組（tools/perf.mjs 的 --shard i/n，09 第 10.2 節）：CI 把固定網址分給幾個同時跑的工作，各量自己那一組。
// 依網址在 urls.json 的順序輪流分（第 k 個網址給第 k mod n 組），所以新增網址不必改 CI：每個網址一定剛好落在一組。純函式，
// 單元測試在 tools/test/perf-shard.test.ts。

/** 解析 "2/3"：第幾組（從 1 起算）與總共幾組；格式不對或超出範圍時丟錯 */
export function parseShard(spec) {
  const m = /^(\d+)\/(\d+)$/.exec(String(spec));
  if (!m) throw new Error(`--shard 要寫成「第幾組/共幾組」，例如 2/3（收到 ${spec}）`);
  const index = Number(m[1]);
  const total = Number(m[2]);
  if (total < 1 || index < 1 || index > total) throw new Error(`--shard 的範圍不對：${spec}`);
  return { index, total };
}

/** 這一組要量的網址：順序不變，第 k 個（從 0 起算）給第 (k mod total) + 1 組 */
export function shardUrls(urls, spec) {
  const { index, total } = parseShard(spec);
  return urls.filter((_, k) => k % total === index - 1);
}
