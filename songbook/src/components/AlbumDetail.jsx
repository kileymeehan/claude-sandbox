import { useState, useCallback } from 'react';
import { saveAlbum } from '../db';

function albumInitials(title) {
  return title.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function albumGradient(title) {
  const hue = (title.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 37) % 360;
  return `linear-gradient(135deg, hsl(${hue},28%,18%), hsl(${(hue + 40) % 360},22%,12%))`;
}

export default function AlbumDetail({ album, songs, onUpdate, onDelete, onOpenSong }) {
  const [local, setLocal] = useState(album);

  const albumSongs = songs.filter(s => s.albumId === album.id);

  const update = useCallback(async (changes) => {
    const next = { ...local, ...changes };
    setLocal(next);
    await saveAlbum(next);
    onUpdate(next);
  }, [local, onUpdate]);

  const handleCoverArt = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => update({ coverArt: e.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}><div style={{ padding: '40px 52px', maxWidth: '760px' }}>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', marginBottom: '40px', flexWrap: 'wrap' }}>
        {/* Cover art */}
        <label style={{ cursor: 'pointer', flexShrink: 0 }} title="Click to upload cover art">
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverArt(e.target.files[0])} />
          <div style={{ width: '140px', height: '140px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
            {local.coverArt ? (
              <img src={local.coverArt} alt={local.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div className="cover-art-placeholder" style={{ height: '100%', background: albumGradient(local.title), borderRadius: '10px', fontSize: '32px' }}>
                {albumInitials(local.title)}
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', borderRadius: '10px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
            >
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>Change art</span>
            </div>
          </div>
        </label>

        {/* Metadata */}
        <div style={{ flex: 1 }}>
          <input
            value={local.title}
            onChange={e => update({ title: e.target.value })}
            placeholder="Album title"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              padding: '2px 0',
              width: '100%',
              marginBottom: '12px',
            }}
            onFocus={e => e.target.style.borderBottomColor = 'var(--border)'}
            onBlur={e => e.target.style.borderBottomColor = 'transparent'}
          />

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              value={local.artist}
              onChange={e => update({ artist: e.target.value })}
              placeholder="Artist"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-secondary)', width: '160px' }}
            />
            <input
              value={local.year}
              onChange={e => update({ year: e.target.value })}
              placeholder="Year"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', color: 'var(--text-secondary)', width: '80px' }}
            />
          </div>
        </div>
      </div>

      <div className="divider" />

      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '14px' }}>
        Songs ({albumSongs.length})
      </h2>

      {albumSongs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
          No songs assigned to this album yet. Open a song and set its album to this one.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {albumSongs.map(song => (
          <div
            key={song.id}
            className="song-card"
            onClick={() => onOpenSong(song.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {song.title || 'Untitled'}
              </span>
              {song.artist && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>{song.artist}</span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {song.sections.length} section{song.sections.length !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
        <button
          onClick={() => { if (confirm(`Delete album "${local.title}"?`)) onDelete(); }}
          style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
        >
          Delete album
        </button>
      </div>
    </div></div>
  );
}
