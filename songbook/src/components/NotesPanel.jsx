import { useState, useRef, useEffect } from 'react';

function compressImage(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = url;
  });
}

export default function NotesPanel({ notes, images, onNotesChange, onImagesChange, onClose }) {
  const [dragging, setDragging] = useState(false);
  const [hoveredImg, setHoveredImg] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [notes]);

  const handleFiles = async (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return;
    const compressed = await Promise.all(valid.map(f => compressImage(f)));
    const newImages = compressed.map(dataUrl => ({ id: crypto.randomUUID(), dataUrl }));
    onImagesChange([...images, ...newImages]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div style={{
      width: '300px',
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px 12px',
        borderBottom: '1px solid var(--border-light)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
          Notes
        </span>
        <button className="icon-btn" onClick={onClose} title="Close">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>

        {/* Freewrite textarea */}
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Describe the scene, the vibe, the feeling you're going for…"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: '13px',
            lineHeight: '1.7',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)',
            padding: 0,
            minHeight: '120px',
            overflow: 'hidden',
          }}
        />

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>images</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--accent-glow)' : 'transparent',
            transition: 'all 0.15s',
            marginBottom: '14px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Drop images here<br />
            <span style={{ color: 'var(--accent)', fontSize: '11px' }}>or click to browse</span>
          </div>
        </div>

        {/* Image stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {images.map(img => (
            <div
              key={img.id}
              style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}
              onMouseEnter={() => setHoveredImg(img.id)}
              onMouseLeave={() => setHoveredImg(null)}
            >
              <img
                src={img.dataUrl}
                alt=""
                style={{ width: '100%', display: 'block', borderRadius: '8px' }}
              />
              {hoveredImg === img.id && (
                <button
                  onClick={() => onImagesChange(images.filter(i => i.id !== img.id))}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '24px', height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '14px',
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
