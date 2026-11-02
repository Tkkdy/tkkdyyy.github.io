/** Browser-local display convention: northern meteorological seasons, no location inference. */
export const TIME_BUCKETS = ['late-night', 'morning', 'daytime', 'dusk', 'night'];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const LATE_GREETING = '这么晚还不睡，早点睡觉哦。';
export function localContext(date = new Date()) {
  const hour = date.getHours(), month = date.getMonth();
  return { time: hour < 5 ? 'late-night' : hour < 11 ? 'morning' : hour < 17 ? 'daytime' : hour < 20 ? 'dusk' : 'night',
    season: month < 2 || month === 11 ? 'winter' : month < 5 ? 'spring' : month < 8 ? 'summer' : 'autumn' };
}
export function photoWeight(photo, context) {
  const time = Array.isArray(photo.timeOfDay) && photo.timeOfDay.includes(context.time);
  const season = Array.isArray(photo.seasons) && photo.seasons.includes(context.season);
  return time && season ? 6 : time || season ? 3 : 1;
}
export function choosePhoto(pool, context, previous = '', random = Math.random) {
  const choices = pool.length > 1 ? pool.filter(photo => photo.id !== previous) : pool;
  const total = choices.reduce((sum, photo) => sum + photoWeight(photo, context), 0);
  let ticket = Math.max(0, Math.min(0.999999999, random())) * total;
  return choices.find(photo => (ticket -= photoWeight(photo, context)) < 0) || choices[0] || null;
}
