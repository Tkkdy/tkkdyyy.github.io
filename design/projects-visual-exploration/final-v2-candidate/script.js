const flipModule = document.querySelector('.flip-module');

if (flipModule) {
  const front = flipModule.querySelector('.flip-front');
  const back = flipModule.querySelector('.flip-back');

  const setFlipped = (flipped) => {
    flipModule.classList.toggle('is-flipped', flipped);
    flipModule.setAttribute('aria-pressed', String(flipped));
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
  };

  flipModule.addEventListener('click', () => {
    setFlipped(flipModule.getAttribute('aria-pressed') !== 'true');
  });

  flipModule.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setFlipped(flipModule.getAttribute('aria-pressed') !== 'true');
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.flip-module')) setFlipped(false);
  });
}
