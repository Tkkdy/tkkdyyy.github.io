(() => {
  const petStates = ["idle", "blink", "pat"];
  let petIndex = 0;
  const petCanvas = document.querySelector(".pet-canvas");
  const petButtons = [...document.querySelectorAll("[data-pet-state]")];
  const petImages = [...document.querySelectorAll("[data-pet-image]")];
  const petReadout = document.querySelector(".state-readout strong");

  function setPetState(state) {
    petIndex = petStates.indexOf(state);
    petButtons.forEach((button) => {
      const active = button.dataset.petState === state;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    petImages.forEach((image) => {
      const active = image.dataset.petImage === state;
      image.classList.toggle("is-visible", active);
      image.setAttribute("aria-hidden", String(!active));
    });
    petReadout.textContent = state.toUpperCase();
    petCanvas.setAttribute("aria-label", `切换桌宠状态；当前 ${state}`);
  }

  petButtons.forEach((button) => button.addEventListener("click", () => setPetState(button.dataset.petState)));
  petCanvas.addEventListener("click", () => setPetState(petStates[(petIndex + 1) % petStates.length]));
  petCanvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPetState(petStates[(petIndex + 1) % petStates.length]);
    }
  });

  const viewportStage = document.querySelector(".viewport-stage");
  const viewportButtons = [...document.querySelectorAll("[data-view]")];
  const viewReadout = document.querySelector(".view-readout");
  viewportButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      viewportStage.dataset.activeView = view;
      viewportButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      viewReadout.textContent = view === "desktop" ? "1440 × 900" : "390 × 844";
    });
  });

  const flip = document.querySelector("#codex-flip");
  function toggleFlip() {
    const flipped = flip.classList.toggle("is-flipped");
    flip.setAttribute("aria-pressed", String(flipped));
  }
  flip.addEventListener("click", toggleFlip);
  flip.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleFlip();
    }
  });
})();
