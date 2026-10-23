// 備份檔與備份碼需要的平台函式（06 第 4.6 節）：SHA-256 用 WebCrypto，壓縮用瀏覽器內建的 CompressionStream（deflate-raw，iOS 16.4 起支援）。
// packages/progress 維持純 TypeScript，這些函式由 apps/web 注入。Node 22 以上也有同樣的全域物件，所以單元測試可以直接跑。

export async function sha256(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

type ByteStream = ReadableWritablePair<Uint8Array, Uint8Array>;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const input = new Blob([bytes as BlobPart]).stream();
  // lib.dom 把 writable 標成 WritableStream<BufferSource>；實際餵進去的是 Uint8Array
  const out = await new Response(input.pipeThrough(stream as unknown as ByteStream)).arrayBuffer();
  return new Uint8Array(out);
}

export function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('deflate-raw'));
}

export function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream('deflate-raw'));
}

export function hasCompressionStream(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}
