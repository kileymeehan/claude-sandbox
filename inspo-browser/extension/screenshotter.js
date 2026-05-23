// Injected when the user clicks "Select area" in the popup.
// Lets the user drag a rectangle, then the background captures + crops that region.

(function () {
  if (document.getElementById('inspo-shot-overlay')) return;

  const style = document.createElement('style');
  style.textContent = `
    #inspo-shot-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      cursor: crosshair;
      background: rgba(0,0,0,0.25);
    }
    #inspo-shot-selection {
      position: fixed; display: none; pointer-events: none;
      border: 2px solid #6366f1;
      background: rgba(99,102,241,0.1);
      z-index: 2147483647;
    }
    #inspo-shot-hint {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #1a1a2e; border: 1px solid #6366f1; border-radius: 8px;
      padding: 8px 18px; color: #e2e2f0;
      font-family: -apple-system, sans-serif; font-size: 13px;
      z-index: 2147483647; pointer-events: none; white-space: nowrap;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'inspo-shot-overlay';
  document.body.appendChild(overlay);

  const sel = document.createElement('div');
  sel.id = 'inspo-shot-selection';
  document.body.appendChild(sel);

  const hint = document.createElement('div');
  hint.id = 'inspo-shot-hint';
  hint.textContent = 'Drag to select area — Esc to cancel';
  document.body.appendChild(hint);

  let startX = 0, startY = 0, dragging = false;

  overlay.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    sel.style.display = 'block';
    updateSel(e.clientX, e.clientY);
  });

  overlay.addEventListener('mousemove', e => {
    if (!dragging) return;
    updateSel(e.clientX, e.clientY);
  });

  overlay.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w < 10 || h < 10) { cleanup(); return; }

    // Remove overlay before capturing so it doesn't appear in the screenshot
    cleanup();
    const dpr = window.devicePixelRatio || 1;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      chrome.runtime.sendMessage({
        type: 'capture-area',
        rect: { x: Math.round(x * dpr), y: Math.round(y * dpr), w: Math.round(w * dpr), h: Math.round(h * dpr) }
      });
    }));
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { once: true });

  function updateSel(cx, cy) {
    sel.style.left   = Math.min(cx, startX) + 'px';
    sel.style.top    = Math.min(cy, startY) + 'px';
    sel.style.width  = Math.abs(cx - startX) + 'px';
    sel.style.height = Math.abs(cy - startY) + 'px';
  }

  function cleanup() {
    overlay.remove();
    sel.remove();
    hint.remove();
    style.remove();
  }
})();
