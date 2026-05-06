import { useState, useMemo } from 'react';

function formatDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SongList({ songs, albums, allTags = [], filter, onOpenSong, onCreateSong, onDeleteSong }) {
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState([]);

  const albumMap = useMemo(() => Object.fromEntries(albums.map(a => [a.id, a])), [albums]);

  // Tags actually present in this song set (for the filter bar)
  const availableTags = useMemo(() => {
    const set = new Set();
    songs.forEach(s => (s.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [songs]);

  // Clear active tags that no longer exist in this view when switching views
  const validActiveTags = activeTags.filter(t => availableTags.includes(t));

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return songs.filter(s => {
      const matchesQuery = !q ||
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        (s.albumId && albumMap[s.albumId]?.title.toLowerCase().includes(q)) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q));
      const matchesTags = validActiveTags.length === 0 ||
        validActiveTags.every(tag => (s.tags || []).includes(tag));
      return matchesQuery && matchesTags;
    });
  }, [songs, query, albumMap, validActiveTags]);

  const grouped = useMemo(() => {
    const byAlbum = {};
    const loose = [];
    for (const song of filtered) {
      if (song.albumId && albumMap[song.albumId]) {
        if (!byAlbum[song.albumId]) byAlbum[song.albumId] = [];
        byAlbum[song.albumId].push(song);
      } else {
        loose.push(song);
      }
    }
    return { byAlbum, loose };
  }, [filtered, albumMap]);

  const toggleTag = (tag) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const titles = { all: 'Library', originals: 'Originals', covers: 'Covers' };
  const emptyMessages = {
    all: { heading: 'Your songbook is empty', sub: 'Start writing your first song.' },
    originals: { heading: 'No original songs yet', sub: 'Write something new.' },
    covers: { heading: 'No covers yet', sub: 'Add a cover song to get started.' },
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {titles[filter]}
        </h1>
        <button className="btn btn-accent" onClick={onCreateSong}>+ New song</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: availableTags.length > 0 ? '12px' : '24px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search songs, artists, albums, tags…"
          style={{
            width: '100%', maxWidth: '440px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: '7px', padding: '9px 14px', fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Tag filter bar */}
      {availableTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px', alignItems: 'center' }}>
          {availableTags.map(tag => {
            const active = validActiveTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  fontSize: '12px', fontWeight: 500,
                  padding: '4px 10px', borderRadius: '20px',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-glow)' : 'var(--tag-bg)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {tag}
              </button>
            );
          })}
          {validActiveTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.3 }}>
            <rect x="6" y="4" width="22" height="28" rx="2" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <line x1="11" y1="12" x2="23" y2="12" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="17" x2="23" y2="17" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="22" x2="18" y2="22" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <h3>
            {(query || validActiveTags.length > 0) ? 'No results' : emptyMessages[filter].heading}
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {query ? `No songs matching "${query}"`
              : validActiveTags.length > 0 ? `No songs tagged with ${validActiveTags.map(t => `"${t}"`).join(' + ')}`
              : emptyMessages[filter].sub}
          </p>
          {!query && !validActiveTags.length && (
            <button className="btn btn-accent" onClick={onCreateSong} style={{ marginTop: '20px' }}>+ New song</button>
          )}
        </div>
      )}

      {/* Album groups */}
      {Object.entries(grouped.byAlbum).map(([albumId, albumSongs]) => {
        const album = albumMap[albumId];
        return (
          <div key={albumId} style={{ marginBottom: '32px' }}>
            <SectionDivider label={album.title} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {albumSongs.map(song => (
                <SongCard key={song.id} song={song} albumMap={albumMap}
                  onOpen={onOpenSong} onDelete={onDeleteSong} onTagClick={toggleTag} activeTags={validActiveTags} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Loose songs */}
      {grouped.loose.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          {Object.keys(grouped.byAlbum).length > 0 && <SectionDivider label="Loose songs" />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {grouped.loose.map(song => (
              <SongCard key={song.id} song={song} albumMap={albumMap}
                onOpen={onOpenSong} onDelete={onDeleteSong} onTagClick={toggleTag} activeTags={validActiveTags} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
    </div>
  );
}

function SongCard({ song, albumMap, onOpen, onDelete, onTagClick, activeTags }) {
  const [showMenu, setShowMenu] = useState(false);
  const album = song.albumId ? albumMap[song.albumId] : null;
  const tags = song.tags || [];

  return (
    <div
      className="song-card"
      onClick={() => onOpen(song.id)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.title || 'Untitled'}
          </span>
          <span className={`badge ${song.type === 'original' ? 'badge-original' : 'badge-cover'}`} style={{ flexShrink: 0 }}>
            {song.type}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '3px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {song.artist && <span>{song.artist}</span>}
          {album && <span>{album.title}</span>}
          <span>{song.sections.length} section{song.sections.length !== 1 ? 's' : ''}</span>
          <span>{formatDate(song.updatedAt)}</span>
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '7px' }}>
            {tags.map(tag => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={e => { e.stopPropagation(); onTagClick(tag); }}
                  style={{
                    fontSize: '11px', fontWeight: 500,
                    padding: '2px 8px', borderRadius: '20px',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--tag-border)'}`,
                    background: active ? 'var(--accent-glow)' : 'var(--tag-bg)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <button
        className="icon-btn"
        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
        style={{ flexShrink: 0, position: 'relative', marginTop: '2px' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>
        </svg>
        {showMenu && (
          <div className="popover fade-in" style={{ top: '100%', right: 0, minWidth: '120px' }} onClick={e => e.stopPropagation()}>
            <button style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '6px 8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer' }}
              onClick={() => { onOpen(song.id); setShowMenu(false); }}>Open</button>
            <button style={{ width: '100%', background: 'none', border: 'none', color: '#c46060', fontSize: '13px', padding: '6px 8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); if (confirm(`Delete "${song.title}"?`)) onDelete(song.id); setShowMenu(false); }}>Delete</button>
          </div>
        )}
      </button>
    </div>
  );
}
