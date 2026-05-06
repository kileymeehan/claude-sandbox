import { useState, useEffect, useRef, useMemo } from 'react';

function highlight(text, query) {
  if (!query.trim() || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent-glow)', color: 'var(--accent)', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

export default function QuickSearch({ songs, albums, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);

  const albumMap = useMemo(() => Object.fromEntries((albums || []).map(a => [a.id, a])), [albums]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    songs.forEach(s => (s.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [songs]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return songs.slice(0, 8);
    return songs.filter(s => {
      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const artistMatch = (s.artist || '').toLowerCase().includes(q);
      const tagMatch = (s.tags || []).some(t => t.toLowerCase().includes(q));
      const albumMatch = s.albumId && albumMap[s.albumId]?.title.toLowerCase().includes(q);
      return titleMatch || artistMatch || tagMatch || albumMatch;
    }).slice(0, 10);
  }, [songs, q, albumMap]);

  // Tags that match the current query (for showing a "filter by tag" suggestion)
  const matchingTags = useMemo(() => {
    if (!q) return [];
    return allTags.filter(t => t.toLowerCase().includes(q));
  }, [allTags, q]);

  useEffect(() => { setHighlighted(0); }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter' && results[highlighted]) onSelect(results[highlighted].id);
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box fade-in" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by title, artist, tag…"
            style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>×</button>
          )}
          <kbd style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>ESC</kbd>
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>

          {/* Matching tag suggestions */}
          {matchingTags.length > 0 && (
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginRight: '2px' }}>Tags</span>
              {matchingTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  style={{
                    fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '20px',
                    border: '1px solid var(--accent)', background: 'var(--accent-glow)',
                    color: 'var(--accent)', cursor: 'pointer',
                  }}
                >
                  {highlight(tag, query)}
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          {results.length === 0 && q ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
              No songs found for "{query}"
            </div>
          ) : (
            results.map((song, i) => {
              const album = song.albumId ? albumMap[song.albumId] : null;
              const matchedTags = q ? (song.tags || []).filter(t => t.toLowerCase().includes(q)) : [];
              const otherTags  = (song.tags || []).filter(t => !matchedTags.includes(t));
              return (
                <button
                  key={song.id}
                  onClick={() => onSelect(song.id)}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '12px 18px',
                    background: i === highlighted ? 'var(--bg-hover)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border-light)',
                    textAlign: 'left', cursor: 'pointer', transition: 'background 0.08s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {highlight(song.title || 'Untitled', query)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`badge ${song.type === 'original' ? 'badge-original' : 'badge-cover'}`}>{song.type}</span>
                      {song.artist && <span>{highlight(song.artist, query)}</span>}
                      {album && <span>{highlight(album.title, query)}</span>}
                    </div>
                    {(matchedTags.length > 0 || otherTags.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {matchedTags.map(tag => (
                          <button
                            key={tag}
                            onMouseDown={e => { e.stopPropagation(); setQuery(tag); }}
                            style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--accent)', background: 'var(--accent-glow)', color: 'var(--accent)', cursor: 'pointer' }}
                          >{tag}</button>
                        ))}
                        {otherTags.map(tag => (
                          <button
                            key={tag}
                            onMouseDown={e => { e.stopPropagation(); setQuery(tag); }}
                            style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--tag-border)', background: 'var(--tag-bg)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                          >{tag}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <kbd style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', opacity: i === highlighted ? 1 : 0, flexShrink: 0, marginTop: '2px' }}>↵</kbd>
                </button>
              );
            })
          )}

          {/* Tag browser (shown when idle) */}
          {!q && allTags.length > 0 && (
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '10px' }}>Browse by tag</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    style={{
                      fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px',
                      border: '1px solid var(--border)', background: 'var(--tag-bg)',
                      color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >{tag}</button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
