import { openDB } from 'idb';

const DB_NAME = 'songbook-db';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('songs')) {
          const songs = db.createObjectStore('songs', { keyPath: 'id' });
          songs.createIndex('albumId', 'albumId', { unique: false });
          songs.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('albums')) {
          db.createObjectStore('albums', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'songId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllSongs() {
  const db = await getDB();
  return db.getAll('songs');
}

export async function getSong(id) {
  const db = await getDB();
  return db.get('songs', id);
}

export async function saveSong(song) {
  const db = await getDB();
  const updated = { ...song, updatedAt: Date.now() };
  await db.put('songs', updated);
  return updated;
}

export async function createSong({ title = 'Untitled', type = 'original', artist = '', albumId = null } = {}) {
  const song = {
    id: crypto.randomUUID(),
    title,
    artist,
    type,
    albumId,
    sections: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = await getDB();
  await db.put('songs', song);
  return song;
}

export async function deleteSong(id) {
  const db = await getDB();
  await db.delete('songs', id);
  try { await db.delete('audio', id); } catch {}
}

export async function getAllAlbums() {
  const db = await getDB();
  return db.getAll('albums');
}

export async function saveAlbum(album) {
  const db = await getDB();
  await db.put('albums', album);
  return album;
}

export async function createAlbum({ title = 'Untitled Album', artist = '', year = new Date().getFullYear() } = {}) {
  const album = {
    id: crypto.randomUUID(),
    title,
    artist,
    year,
    coverArt: null,
    songIds: [],
    createdAt: Date.now(),
  };
  const db = await getDB();
  await db.put('albums', album);
  return album;
}

export async function deleteAlbum(id) {
  const db = await getDB();
  await db.delete('albums', id);
}

export async function saveAudio(songId, blob) {
  const db = await getDB();
  await db.put('audio', { songId, blob, savedAt: Date.now() });
}

export async function getAudio(songId) {
  const db = await getDB();
  const entry = await db.get('audio', songId);
  return entry?.blob ?? null;
}

export async function deleteAudio(songId) {
  const db = await getDB();
  await db.delete('audio', songId);
}

export function newSection(type = 'verse') {
  return { id: crypto.randomUUID(), type, customLabel: '', lines: [] };
}

export function newLine() {
  return { id: crypto.randomUUID(), lyric: '', chords: [] };
}

export function newChord(chord, position) {
  return { id: crypto.randomUUID(), chord, position };
}

export function sectionDisplayLabel(section) {
  if (section.type === 'custom') return section.customLabel || 'Section';
  return {
    verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge',
    'pre-chorus': 'Pre-Chorus', 'middle-eight': 'Middle Eight',
    outro: 'Outro', intro: 'Intro', hook: 'Hook',
  }[section.type] ?? section.type;
}
