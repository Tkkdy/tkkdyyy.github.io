const dialog = document.querySelector('[data-evidence-dialog]');
const openButton = document.querySelector('[data-open-evidence]');
const closeButton = document.querySelector('[data-close-evidence]');

if (dialog instanceof HTMLDialogElement && openButton instanceof HTMLButtonElement) {
  openButton.addEventListener('click', () => dialog.showModal());
  closeButton?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

