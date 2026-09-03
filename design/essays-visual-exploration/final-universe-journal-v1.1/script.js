(() => {
  const field = document.querySelector('.star-field');
  const themeControls = [...document.querySelectorAll('[data-theme-control]')];
  const stageControls = [...document.querySelectorAll('[data-stage-control]')];
  const nodes = [...document.querySelectorAll('.star-node')];
  const themeClasses = themeControls.map(({ dataset }) => `theme-${dataset.themeControl}`);
  const stageClasses = stageControls.map(({ dataset }) => `stage-${dataset.stageControl}`);
  let active = null;

  const clearMap = () => { field.classList.remove(...themeClasses, ...stageClasses); nodes.forEach((node) => node.classList.remove('is-muted')); };
  const setPressed = (control, pressed) => control.setAttribute('aria-pressed', String(pressed));
  const clearControls = () => [...themeControls, ...stageControls].forEach((control) => setPressed(control, false));
  const apply = (kind, value) => {
    clearMap();
    field.classList.add(`${kind}-${value}`);
    nodes.forEach((node) => {
      const related = kind === 'stage' ? node.dataset.stage === value : node.dataset.themes.split(',').includes(value);
      node.classList.toggle('is-muted', !related);
    });
  };
  const restore = () => { clearMap(); if (active) apply(active.kind, active.value); };

  const bind = (controls, kind, key) => controls.forEach((control) => {
    const value = control.dataset[key];
    control.addEventListener('mouseenter', () => apply(kind, value));
    control.addEventListener('mouseleave', restore);
    control.addEventListener('focus', () => apply(kind, value));
    control.addEventListener('blur', restore);
    control.addEventListener('click', () => {
      const same = active?.kind === kind && active?.value === value;
      clearControls();
      if (same) { active = null; clearMap(); return; }
      active = { kind, value };
      setPressed(control, true);
      apply(kind, value);
    });
  });

  bind(themeControls, 'theme', 'themeControl');
  bind(stageControls, 'stage', 'stageControl');
})();
