// 손님이 고른 사진을 브라우저에서 바로 줄여요. (긴 변 1280px 이하, 약 200KB 이하 JPEG)
// 손님은 따로 용량을 줄일 필요가 없어요.
async function decode(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const im = new Image();
    await new Promise<void>((ok, fail) => {
      im.onload = () => ok();
      im.onerror = () => fail(new Error("이미지를 열 수 없어요"));
      im.src = url;
    });
    return { img: im, w: im.naturalWidth, h: im.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("변환 실패"))), "image/jpeg", q));

export async function compressImage(file: File, maxBytes = 200 * 1024, maxSide = 1280): Promise<Blob> {
  const { img, w, h, done } = await decode(file);
  try {
    let side = maxSide;
    for (let round = 0; round < 4; round++) {
      const sc = Math.min(1, side / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * sc));
      c.height = Math.max(1, Math.round(h * sc));
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
        const b = await toBlob(c, q);
        if (b.size <= maxBytes) return b;
      }
      side = Math.round(side * 0.75);
    }
    throw new Error("사진을 줄이지 못했어요");
  } finally {
    done();
  }
}
