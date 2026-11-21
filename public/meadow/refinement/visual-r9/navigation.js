// Both presentations use the same R6 host and preserve explicit review settings.
for (const link of document.querySelectorAll('[data-scene-link]')) {
  const target = new URL(link.href);
  target.search = location.search;
  link.href = target.href;
}
