import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllSongs, getAllAlbums, saveSong, createSong, deleteSong, saveAlbum, createAlbum, deleteAlbum } from './db';
import { applyFont } from './fonts';
import Sidebar from './components/Sidebar';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import AlbumGrid from './components/AlbumGrid';
import AlbumDetail from './components/AlbumDetail';
import QuickSearch from './components/QuickSearch';
import CircleOfFifths from './components/CircleOfFifths';
import Settings from './components/Settings';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [view, setView] = useState('library');
  const [selectedSongId, setSelectedSongId] = useState(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [showCircle, setShowCircle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('sb-theme') || 'dark');
  const [font, setFont] = useState(() => localStorage.getItem('sb-font') || 'playfair');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sb-theme', theme);
  }, [theme]);

  useEffect(() => {
    applyFont(font);
    localStorage.setItem('sb-font', font);
  }, [font]);

  useEffect(() => {
    Promise.all([getAllSongs(), getAllAlbums()]).then(([s, a]) => {
      setSongs(s.sort((a, b) => b.updatedAt - a.updatedAt));
      setAlbums(a.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('force-save'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    songs.forEach(s => (s.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [songs]);

  const handleSongUpdate = useCallback((updated) => {
    setSongs(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  const handleCreateSong = async (opts = {}) => {
    const song = await createSong(opts);
    setSongs(prev => [song, ...prev]);
    setSelectedSongId(song.id);
    setView('song');
  };

  const handleDeleteSong = useCallback(async (id) => {
    await deleteSong(id);
    setSongs(prev => prev.filter(s => s.id !== id));
    if (selectedSongId === id) {
      setSelectedSongId(null);
      setView('library');
    }
  }, [selectedSongId]);

  const handleCreateAlbum = async () => {
    const album = await createAlbum();
    setAlbums(prev => [album, ...prev]);
    setSelectedAlbumId(album.id);
    setView('album');
  };

  const handleAlbumUpdate = useCallback((updated) => {
    setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
  }, []);

  const handleDeleteAlbum = useCallback(async (id) => {
    await deleteAlbum(id);
    setAlbums(prev => prev.filter(a => a.id !== id));
    if (selectedAlbumId === id) {
      setSelectedAlbumId(null);
      setView('albums');
    }
  }, [selectedAlbumId]);

  const openSong = (id) => { setSelectedSongId(id); setView('song'); };
  const openAlbum = (id) => { setSelectedAlbumId(id); setView('album'); };

  const selectedSong = songs.find(s => s.id === selectedSongId);
  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);

  if (loading) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--text-muted)' }}>Opening songbook…</span>
      </div>
    );
  }

  return (
    <div className="app-root" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        view={view}
        setView={setView}
        songs={songs}
        albums={albums}
        onCreateSong={handleCreateSong}
        onCreateAlbum={handleCreateAlbum}
        onSearch={() => setShowQuickSearch(true)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'library' && (
          <SongList songs={songs} albums={albums} allTags={allTags} filter="all"
            onOpenSong={openSong} onCreateSong={() => handleCreateSong()} onDeleteSong={handleDeleteSong} />
        )}
        {view === 'originals' && (
          <SongList songs={songs.filter(s => s.type === 'original')} albums={albums} allTags={allTags} filter="originals"
            onOpenSong={openSong} onCreateSong={() => handleCreateSong({ type: 'original' })} onDeleteSong={handleDeleteSong} />
        )}
        {view === 'covers' && (
          <SongList songs={songs.filter(s => s.type === 'cover')} albums={albums} allTags={allTags} filter="covers"
            onOpenSong={openSong} onCreateSong={() => handleCreateSong({ type: 'cover' })} onDeleteSong={handleDeleteSong} />
        )}
        {view === 'albums' && (
          <AlbumGrid albums={albums} songs={songs} onOpenAlbum={openAlbum} onCreateAlbum={handleCreateAlbum} />
        )}
        {view === 'song' && selectedSong && (
          <SongEditor
            key={selectedSong.id}
            song={selectedSong}
            albums={albums}
            allTags={allTags}
            onUpdate={handleSongUpdate}
            onDelete={() => handleDeleteSong(selectedSong.id)}
            onShowCircle={() => setShowCircle(true)}
          />
        )}
        {view === 'album' && selectedAlbum && (
          <AlbumDetail
            album={selectedAlbum}
            songs={songs}
            onUpdate={handleAlbumUpdate}
            onDelete={() => handleDeleteAlbum(selectedAlbum.id)}
            onOpenSong={openSong}
          />
        )}
        {view === 'settings' && (
          <Settings
            font={font}
            onFontChange={setFont}
            theme={theme}
            onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          />
        )}
        {(view === 'song' && !selectedSong) && (
          <div className="empty-state"><h3>Song not found</h3></div>
        )}
      </div>

      {showQuickSearch && (
        <QuickSearch
          songs={songs}
          albums={albums}
          onSelect={(id) => { openSong(id); setShowQuickSearch(false); }}
          onClose={() => setShowQuickSearch(false)}
        />
      )}
      {showCircle && <CircleOfFifths onClose={() => setShowCircle(false)} />}
    </div>
  );
}
