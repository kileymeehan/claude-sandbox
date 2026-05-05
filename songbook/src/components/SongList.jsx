import { useState, useMemo } from 'react';

function formatDate(ts) {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SongList({ songs, albums, filter, onOpenSong, onCreateSong, onDeleteSong }) {
  const [query, setQuery] = useState('');

  const albumMap = useMemo(() => {
    return Object.fromEntries(albums.map(a => [a.id, a]));
  }, [albums]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return songs;
    return songs.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.albumId && albumMap[s.albumId]?.title.toLowerCase().includes(q))
    );
  }, [songs, query, albumMap]);

  const grouped = useMemo(() => {
    const byAlbum = {};
    const loose = [];
    for (const song of filtered) {
      if (song.albumId && albumMap[song.albumId]) {
        const key = song.albumId;
        if (!byAlbum[key]) byAlbum[key] = [];
        byAlbum[key].push(song);
      } else {
        loose.push(song);
      }
    }
    return { byAlbum, loose };
  }, [filtered, albumMap]);

  const titles = {
    all: 'Library',
    originals: 'Originals',
    covers: 'Covers',
  };

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

      <div style={{ marginBottom: '24px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search songs, artists, albums…"
          style={{
            width: '100%',
            maxWidth: '400px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '7px',
            padding: '9px 14px',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.3 }}>
            <rect x="6" y="4" width="22" height="28" rx="2" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <line x1="11" y1="12" x2="23" y2="12" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="17" x2="23" y2="17" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="22" x2="18" y2="22" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <h3>{query ? 'No results' : emptyMessages[filter].heading}</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {query ? `No songs matching "${query}"` : emptyMessages[filter].sub}
          </p>
          {!query && (
            <button className="btn btn-accent" onClick={onCreateSong} style={{ marginTop: '20px' }}>
              + New song
            </button>
          )}
        </div>
      )}

      {Object.entries(grouped.byAlbum).map(([albumId, albumSongs]) => {
        const album = albumMap[albumId];
        return (
          <div key={albumId} style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                {album.title}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {albumSongs.map(song => (
                <SongCard key={song.id} song={song} albumMap={albumMap} onOpen={onOpenSong} onDelete={onDeleteSong} />
              ))}
            </div>
          </div>
        );
      })}

      {grouped.loose.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          {Object.keys(grouped.byAlbum).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                Loose songs
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {grouped.loose.map(song => (
              <SongCard key={song.id} song={song} albumMap={albumMap} onOpen={onOpenSong} onDelete={onDeleteSong} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SongCard({ song, albumMap, onOpen, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const album = song.albumId ? albumMap[song.albumId] : null;

  return (
    <div
      className="song-card"
      onClick={() => onOpen(song.id)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
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
        <div style={{ display: 'flex', gap: '12px', marginTop: '3px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {song.artist && <span>{song.artist}</span>}
          {album && <span>{album.title}</span>}
          <span>{song.sections.length} section{song.sections.length !== 1 ? 's' : ''}</span>
          <span>{formatDate(song.updatedAt)}</span>
        </div>
      </div>
      <button
        className="icon-btn"
        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
        style={{ flexShrink: 0, position: 'relative' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>
        </svg>
        {showMenu && (
          <div
            className="popover"
            style={{ top: '100%', right: 0, minWidth: '120px' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', padding: '6px 8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer' }}
              onClick={() => { onOpen(song.id); setShowMenu(false); }}
            >
              Open
            </button>
            <button
              style={{ width: '100%', background: 'none', border: 'none', color: '#c46060', fontSize: '13px', padding: '6px 8px', textAlign: 'left', borderRadius: '4px', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${song.title}"?`)) onDelete(song.id); setShowMenu(false); }}
            >
              Delete
            </button>
          </div>
        )}
      </button>
    </div>
  );
}
