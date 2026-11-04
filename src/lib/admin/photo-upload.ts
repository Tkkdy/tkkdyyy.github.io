/** Decode locally and redraw pixels: originals and EXIF/GPS never enter drafts. */
export const PHOTO_SOURCE_MAX_BYTES = 50_000_000;
const PHOTO_SAVED_MAX_BYTES = 950_000;
export async function photoUploadDataUrl(file: File): Promise<string> {
  if (file.size > PHOTO_SOURCE_MAX_BYTES) throw Error('照片不得超过 50 MB。');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  try {
    if (bitmap.width * bitmap.height > 100_000_000) throw Error('照片尺寸过大，请先缩小图片。');
    let scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
    const context = canvas.getContext('2d');
    if (!context) throw Error('浏览器无法处理照片，请使用已去除元数据的图片。');
    for (let attempt = 0; attempt < 10; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.8, 0.7]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) throw Error('照片压缩失败，请重试。');
        if (blob.size <= PHOTO_SAVED_MAX_BYTES) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(Error('无法读取压缩后的照片。'));
            reader.readAsDataURL(blob);
          });
        }
      }
      scale *= 0.8;
    }
    throw Error('照片无法压缩到保存限制内，请缩小后重试。');
  } finally { bitmap.close(); canvas.width = canvas.height = 1; }
}
