function albumInitials(title) {
  return title.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function albumGradient(title) {
  const hue = (title.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 37) % 360;
  return `linear-gradient(135deg, hsl(${hue},28%,18%), hsl(${(hue + 40) % 360},22%,12%))`;
}

export default function AlbumGrid({ albums, songs, onOpenAlbum, onCreateAlbum }) {
  if (albums.length === 0) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Albums</h1>
          <button className="btn btn-accent" onClick={onCreateAlbum}>+ New album</button>
        </div>
        <div className="empty-state">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ opacity: 0.3 }}>
            <rect x="4" y="8" width="24" height="28" rx="2" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <rect x="10" y="4" width="24" height="28" rx="2" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <circle cx="22" cy="20" r="4" stroke="var(--text-muted)" strokeWidth="1.5"/>
            <circle cx="22" cy="20" r="1.5" fill="var(--text-muted)"/>
          </svg>
          <h3>No albums yet</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Collect your songs into albums.</p>
          <button className="btn btn-accent" onClick={onCreateAlbum} style={{ marginTop: '20px' }}>+ New album</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '40px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Albums</h1>
        <button className="btn btn-accent" onClick={onCreateAlbum}>+ New album</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
        {albums.map(album => {
          const songCount = songs.filter(s => s.albumId === album.id).length;
          return (
            <div key={album.id} className="album-card" onClick={() => onOpenAlbum(album.id)}>
              {album.coverArt ? (
                <img src={album.coverArt} alt={album.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className="cover-art-placeholder" style={{ background: albumGradient(album.title) }}>
                  {albumInitials(album.title)}
                </div>
              )}
              <div style={{ padding: '12px' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {album.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {album.artist && <span>{album.artist} · </span>}
                  {album.year && <span>{album.year} · </span>}
                  <span>{songCount} song{songCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
