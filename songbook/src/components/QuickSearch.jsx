import { useState, useEffect, useRef } from 'react';

export default function QuickSearch({ songs, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const results = query.trim()
    ? songs.filter(s =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : songs.slice(0, 8);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && results[highlighted]) { onSelect(results[highlighted].id); }
    if (e.key === 'Escape') { onClose(); }
  };

  useEffect(() => { setHighlighted(0); }, [query]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border-light)' }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '16px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
            }}
          />
          <kbd style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px' }}>
            ESC
          </kbd>
        </div>

        {results.length === 0 && (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
            No songs found
          </div>
        )}

        <div style={{ maxHeight: '360px', overflow: 'auto' }}>
          {results.map((song, i) => (
            <button
              key={song.id}
              onClick={() => onSelect(song.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 18px',
                background: i === highlighted ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-light)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.08s',
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>
                  {song.title || 'Untitled'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                  <span className={`badge ${song.type === 'original' ? 'badge-original' : 'badge-cover'}`}>{song.type}</span>
                  {song.artist && <span>{song.artist}</span>}
                </div>
              </div>
              <kbd style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', opacity: i === highlighted ? 1 : 0 }}>
                ↵
              </kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
