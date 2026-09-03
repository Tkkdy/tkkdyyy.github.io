(async () => {
  const host = document.body;
  const response = await fetch(host.dataset.source);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  document.documentElement.lang = doc.documentElement.lang || 'zh-CN';
  document.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.title}</title><link rel="icon" href="data:,">`;
  const base = document.createElement('link'); base.rel = 'stylesheet'; base.href = host.dataset.style; document.head.append(base);
  const type = document.createElement('link'); type.rel = 'stylesheet'; type.href = 'styles.css'; document.head.append(type);
  document.body.replaceWith(doc.body);
  document.body.querySelectorAll('a[href="index.html"]').forEach((link) => { link.href = 'index.html'; });
  if (host.dataset.source.includes('final-universe-journal-v1.1')) document.body.append(Object.assign(document.createElement('script'), { src: '../final-universe-journal-v1.1/script.js' }));
  document.body.append(Object.assign(document.createElement('script'), { src: 'interactions.js' }));
})();
