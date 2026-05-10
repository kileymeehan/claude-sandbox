import { useState, useEffect } from 'react';
import { openDB } from 'idb';
import { saveSong, saveAlbum } from '../db';

async function readLocalDB() {
  try {
    const db = await openDB('songbook-db', 1);
    const songs  = db.objectStoreNames.contains('songs')  ? await db.getAll('songs')  : [];
    const albums = db.objectStoreNames.contains('albums') ? await db.getAll('albums') : [];
    return { songs, albums };
  } catch {
    return { songs: [], albums: [] };
  }
}

export default function MigratePrompt({ userId, onDone }) {
  const [localCount, setLocalCount] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | migrating | done | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    const key = `sb-migrated-${userId}`;
    if (localStorage.getItem(key)) { onDone(); return; }
    readLocalDB().then(({ songs, albums }) => {
      if (songs.length === 0 && albums.length === 0) {
        localStorage.setItem(key, '1');
        onDone();
      } else {
        setLocalCount(songs.length + albums.length);
      }
    });
  }, [userId, onDone]);

  const handleMigrate = async () => {
    setStatus('migrating');
    const { songs, albums } = await readLocalDB();
    const total = songs.length + albums.length;
    setProgress({ done: 0, total });
    let done = 0;
    for (const album of albums) {
      try { await saveAlbum(album); } catch {}
      setProgress({ done: ++done, total });
    }
    for (const song of songs) {
      try { await saveSong(song); } catch {}
      setProgress({ done: ++done, total });
    }
    localStorage.setItem(`sb-migrated-${userId}`, '1');
    setStatus('done');
  };

  const handleSkip = () => {
    localStorage.setItem(`sb-migrated-${userId}`, '1');
    onDone();
  };

  if (localCount === null) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box fade-in" style={{ padding: '32px', maxWidth: '420px' }}>

        {status === 'idle' && (
          <>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              Import local songs?
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
              You have <strong>{localCount}</strong> song{localCount !== 1 ? 's/albums' : '/album'} saved locally in this browser. Would you like to import them into your account so they're available everywhere?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-accent" style={{ fontSize: '13px' }} onClick={handleMigrate}>
                Import to my account
              </button>
              <button className="btn" style={{ fontSize: '13px' }} onClick={handleSkip}>
                Skip
              </button>
            </div>
          </>
        )}

        {status === 'migrating' && (
          <>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Importing…
            </h3>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: '3px', width: `${(progress.done / progress.total) * 100}%`, transition: 'width 0.2s' }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {progress.done} of {progress.total}
            </p>
          </>
        )}

        {status === 'done' && (
          <>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
              All done
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
              Your local songs have been imported. They'll now sync across all your devices.
            </p>
            <button className="btn btn-accent" style={{ fontSize: '13px' }} onClick={onDone}>
              Open my songbook
            </button>
          </>
        )}

      </div>
    </div>
  );
}
