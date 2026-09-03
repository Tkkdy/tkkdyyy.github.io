(() => {
  const field = document.querySelector('.star-field');
  const controls = document.querySelectorAll('[data-theme-control]');
  const clear = () => field.classList.remove('theme-life', 'theme-thought', 'theme-memory', 'theme-city', 'theme-observation', 'theme-writing');
  controls.forEach((control) => {
    const apply = () => { clear(); field.classList.add(`theme-${control.dataset.themeControl}`); };
    control.addEventListener('mouseenter', apply);
    control.addEventListener('focus', apply);
    control.addEventListener('mouseleave', clear);
    control.addEventListener('blur', clear);
  });
})();
