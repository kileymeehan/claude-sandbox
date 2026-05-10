const icons = {
  library: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="2" width="4" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="6.5" y="2" width="4" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="12" y="5" width="1.5" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2" transform="rotate(-15 12 5)"/>
    </svg>
  ),
  originals: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5L9.2 5.8L14 6.3L10.5 9.6L11.5 14L7.5 11.8L3.5 14L4.5 9.6L1 6.3L5.8 5.8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  covers: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="7.5" y1="1.5" x2="7.5" y2="5.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  albums: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="3" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="4" y="1" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M2.9 2.9l1.4 1.4M10.7 10.7l1.4 1.4M2.9 12.1l1.4-1.4M10.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  plus: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  search: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M9.5 9.5l3.2 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
};

export default function Sidebar({ view, setView, songs, albums, onCreateSong, onCreateAlbum, onSearch, onSignOut, userEmail, theme, onToggleTheme }) {
  const counts = {
    library: songs.length,
    originals: songs.filter(s => s.type === 'original').length,
    covers: songs.filter(s => s.type === 'cover').length,
    albums: albums.length,
  };

  const nav = [
    { id: 'library', label: 'Library', icon: icons.library },
    { id: 'originals', label: 'Originals', icon: icons.originals },
    { id: 'covers', label: 'Covers', icon: icons.covers },
    { id: 'albums', label: 'Albums', icon: icons.albums },
  ];

  return (
    <div style={{
      width: '220px',
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      gap: '2px',
    }}>
      <div style={{ padding: '0 10px 20px', borderBottom: '1px solid var(--border-light)', marginBottom: '12px' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          Songbook
        </span>
      </div>

      {nav.map(item => (
        <button
          key={item.id}
          className={`nav-item ${view === item.id ? 'active' : ''}`}
          onClick={() => setView(item.id)}
        >
          {item.icon}
          <span style={{ flex: 1 }}>{item.label}</span>
          {counts[item.id] > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              {counts[item.id]}
            </span>
          )}
        </button>
      ))}

      <button className="nav-item" onClick={onSearch} style={{ marginTop: '4px' }}>
        {icons.search}
        <span style={{ flex: 1 }}>Search</span>
        <kbd style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px', fontFamily: 'var(--font-sans)' }}>⌘K</kbd>
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button className="nav-item" onClick={onCreateSong} style={{ color: 'var(--accent)' }}>
          {icons.plus}
          New song
        </button>
        <button className="nav-item" onClick={onCreateAlbum}>
          {icons.plus}
          New album
        </button>
        <button
          className={`nav-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => setView('settings')}
        >
          {icons.settings}
          Settings
        </button>
        <button className="nav-item" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 1.5v1.2M7.5 12.3v1.2M1.5 7.5h1.2M12.3 7.5h1.2M3.4 3.4l.85.85M10.75 10.75l.85.85M10.75 3.4l-.85.85M3.4 10.75l.85-.85" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M13 8A5.5 5.5 0 1 1 7 2A4 4 0 0 0 13 8Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          )}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Account */}
        <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '8px', paddingTop: '10px' }}>
          {userEmail && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 10px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
          )}
          <button className="nav-item" onClick={onSignOut}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v9a1 1 0 001 1h3M10 10l3-3-3-3M13 7.5H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
