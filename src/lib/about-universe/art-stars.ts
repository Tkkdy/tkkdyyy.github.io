export interface ArtStar { x: number; y: number; radius: number }

/** Pick small bright peaks from the painting, not cloud edges or a second random starfield. */
export function detectArtStars(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number, limit = 440): ArtStar[] {
  const luminance = new Float32Array(width * height);
  for (let i = 0; i < luminance.length; i++) {
    const offset = i * 4;
    luminance[i] = pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
  }
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = 6; y < height - 6; y++) {
    for (let x = 6; x < width - 6; x++) {
      const i = y * width + x, value = luminance[i];
      if (value < 55) continue;
      const background = (luminance[i - 5] + luminance[i + 5] + luminance[i - width * 5] + luminance[i + width * 5]) / 4;
      const contrast = value - background;
      if (contrast < 18) continue;
      if (value < luminance[i - 1] || value < luminance[i + 1] ||
          value < luminance[i - width] || value < luminance[i + width] ||
          value < luminance[i - width - 1] || value < luminance[i + width + 1]) continue;
      candidates.push({ x, y, score: contrast });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (selected.some(star => Math.hypot(star.x - candidate.x, star.y - candidate.y) < 9)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected.map(star => ({
    x: (star.x + 0.5) / width,
    y: (star.y + 0.5) / height,
    radius: Math.min(2.1, 1.05 + star.score / 170),
  }));
}
