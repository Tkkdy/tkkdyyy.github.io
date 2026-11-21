document.querySelector('#key-state').onchange=e=>window.__integration?.ready&&__integration.setKey(e.target.value);

document.querySelector('[data-house-frame]').onclick=()=>window.__integration?.ready&&__integration.houseFrame();

// A short tap immediately following a canvas drag can lose its compatibility
// click on Chromium touch devices. Keep the native summary for mouse/keyboard.
const summary = document.querySelector('.scene-tools summary');
let contact;
summary.addEventListener('touchstart', event => {
 const touch = event.touches[0];
 contact = event.touches.length === 1 ? [touch.clientX,touch.clientY] : null;
}, {passive:true});
summary.addEventListener('touchend', event => {
 const touch = event.changedTouches[0];
 const tap = contact && !event.touches.length && Math.hypot(touch.clientX-contact[0],touch.clientY-contact[1]) < 10;
 contact = null;
 if (!tap || !event.cancelable) return;
 event.preventDefault();
 summary.parentElement.open = !summary.parentElement.open;
 summary.focus({preventScroll:true});
}, {passive:false});
summary.addEventListener('touchcancel', () => {contact=null;});
