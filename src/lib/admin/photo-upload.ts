/** Photo uploads use a new pixel buffer so EXIF/GPS/device tags never reach public uploads. */
export async function photoUploadDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 100_000_000) throw Error('照片尺寸过大，请先缩小图片。');
    const scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw Error('浏览器无法处理照片，请使用已去除元数据的图片。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.9);
  } finally { bitmap.close(); }
}
