// Injected by the popup "Pick images" button.
// Lets the user click images on the page to select them, then send to Inspo.

(function () {
  if (document.getElementById('inspo-picker-bar')) return; // already active

  const selected = new Set();
  const anchorListeners = new Map(); // track added listeners for cleanup

  const style = document.createElement('style');
  style.id = 'inspo-picker-styles';
  style.textContent = `
    body.inspo-picking * { cursor: crosshair !important; user-select: none !important; }
    .inspo-img-target {
      outline: 2px dashed rgba(99,102,241,0.5) !important;
      outline-offset: 2px;
      transition: outline 0.1s;
    }
    .inspo-img-target:hover { outline: 2px solid #6366f1 !important; }
    .inspo-img-selected { outline: 3px solid #6366f1 !important; }
    #inspo-picker-bar {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1a1a2e; border: 1px solid #6366f1; border-radius: 12px;
      padding: 10px 16px; display: flex; align-items: center; gap: 12px;
      z-index: 2147483647; font-family: -apple-system, sans-serif;
      font-size: 13px; color: #e2e2f0; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      white-space: nowrap;
    }
    #inspo-picker-count { color: #a5b4fc; font-weight: 500; }
    #inspo-picker-send {
      background: #6366f1; color: white; border: none; border-radius: 7px;
      padding: 6px 14px; cursor: pointer; font-size: 12px; font-weight: 500;
    }
    #inspo-picker-send:hover { background: #4f52e0; }
    #inspo-picker-send:disabled { background: #2a2a3e; color: #4b5563; cursor: default; }
    #inspo-picker-cancel {
      background: none; border: none; color: #6b7280; cursor: pointer; font-size: 12px;
    }
    #inspo-picker-cancel:hover { color: #e2e2f0; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'inspo-picker-bar';
  bar.innerHTML = `
    <span>Click images to select</span>
    <span id="inspo-picker-count">0 selected</span>
    <button id="inspo-picker-send" disabled>Send to SwatchBook</button>
    <button id="inspo-picker-cancel">Cancel</button>
  `;
  document.body.appendChild(bar);
  document.body.classList.add('inspo-picking');

  const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
    const { width, height } = img.getBoundingClientRect();
    return width > 80 && height > 80;
  });

  imgs.forEach(img => {
    img.classList.add('inspo-img-target');
    img.addEventListener('click', onImgClick, true);

    // Prevent parent anchor from navigating when image is clicked
    const anchor = img.closest('a');
    if (anchor && !anchorListeners.has(anchor)) {
      const block = e => { e.preventDefault(); e.stopPropagation(); };
      anchor.addEventListener('click', block, true);
      anchorListeners.set(anchor, block);
    }
  });

  function onImgClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const img = e.currentTarget;
    const src = img.src;
    if (selected.has(src)) {
      selected.delete(src);
      img.classList.remove('inspo-img-selected');
    } else {
      selected.add(src);
      img.classList.add('inspo-img-selected');
    }
    const count = selected.size;
    document.getElementById('inspo-picker-count').textContent = `${count} selected`;
    const sendBtn = document.getElementById('inspo-picker-send');
    sendBtn.disabled = count === 0;
    sendBtn.textContent = count > 0 ? `Send ${count} to SwatchBook` : 'Send to SwatchBook';
  }

  document.getElementById('inspo-picker-send').addEventListener('click', async () => {
    const urls = [...selected];
    const sendBtn = document.getElementById('inspo-picker-send');
    sendBtn.textContent = 'Sending…';
    sendBtn.disabled = true;

    const res = await chrome.runtime.sendMessage({ type: 'upload-urls', urls });
    const ok = res.results.filter(r => r.ok).length;
    const fail = res.results.filter(r => !r.ok).length;
    sendBtn.textContent = `Sent ${ok}${fail ? `, ${fail} failed` : ''}`;
    setTimeout(cleanup, 1800);
  });

  document.getElementById('inspo-picker-cancel').addEventListener('click', cleanup);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { once: true });

  function cleanup() {
    imgs.forEach(img => {
      img.classList.remove('inspo-img-target', 'inspo-img-selected');
      img.removeEventListener('click', onImgClick, true);
    });
    anchorListeners.forEach((listener, anchor) => {
      anchor.removeEventListener('click', listener, true);
    });
    anchorListeners.clear();
    bar.remove();
    style.remove();
    document.body.classList.remove('inspo-picking');
  }
})();
