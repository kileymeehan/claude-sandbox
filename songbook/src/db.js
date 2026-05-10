import { supabase } from './lib/supabase';

// ── Row mappers ───────────────────────────────────────────────────────────────

function songToDb(song) {
  return {
    id: song.id,
    title: song.title || 'Untitled',
    artist: song.artist || '',
    type: song.type || 'original',
    album_id: song.albumId || null,
    tags: song.tags || [],
    notes: song.notes || '',
    mood_images: song.moodImages || [],
    sections: song.sections || [],
    updated_at: new Date().toISOString(),
  };
}

function dbToSong(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    type: row.type,
    albumId: row.album_id,
    tags: row.tags || [],
    notes: row.notes || '',
    moodImages: row.mood_images || [],
    sections: row.sections || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function albumToDb(album) {
  return {
    id: album.id,
    title: album.title || 'Untitled Album',
    artist: album.artist || '',
    year: album.year || new Date().getFullYear(),
    cover_art: album.coverArt || null,
    song_ids: album.songIds || [],
  };
}

function dbToAlbum(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    coverArt: row.cover_art,
    songIds: row.song_ids || [],
    createdAt: new Date(row.created_at).getTime(),
  };
}

// ── Songs ─────────────────────────────────────────────────────────────────────

export async function getAllSongs() {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(dbToSong);
}

export async function getSong(id) {
  const { data, error } = await supabase
    .from('songs').select('*').eq('id', id).single();
  if (error) throw error;
  return dbToSong(data);
}

export async function saveSong(song) {
  const { data, error } = await supabase
    .from('songs').upsert(songToDb(song)).select().single();
  if (error) throw error;
  return dbToSong(data);
}

export async function createSong({ title = 'Untitled', type = 'original', artist = '', albumId = null } = {}) {
  const song = {
    id: crypto.randomUUID(),
    title, artist, type, albumId,
    tags: [], notes: '', moodImages: [], sections: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  return saveSong(song);
}

export async function deleteSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw error;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.storage.from('audio').remove([`${user.id}/${id}`]);
  } catch {}
}

// ── Albums ────────────────────────────────────────────────────────────────────

export async function getAllAlbums() {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(dbToAlbum);
}

export async function saveAlbum(album) {
  const { data, error } = await supabase
    .from('albums').upsert(albumToDb(album)).select().single();
  if (error) throw error;
  return dbToAlbum(data);
}

export async function createAlbum({ title = 'Untitled Album', artist = '', year = new Date().getFullYear() } = {}) {
  const album = {
    id: crypto.randomUUID(),
    title, artist, year,
    coverArt: null, songIds: [],
    createdAt: Date.now(),
  };
  return saveAlbum(album);
}

export async function deleteAlbum(id) {
  const { error } = await supabase.from('albums').delete().eq('id', id);
  if (error) throw error;
}

// ── Audio (Supabase Storage) ──────────────────────────────────────────────────

export async function saveAudio(songId, blob) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.storage
    .from('audio')
    .upload(`${user.id}/${songId}`, blob, { upsert: true });
  if (error) throw error;
}

export async function getAudio(songId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.storage
    .from('audio')
    .download(`${user.id}/${songId}`);
  if (error) return null;
  return data;
}

export async function deleteAudio(songId) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.storage.from('audio').remove([`${user.id}/${songId}`]);
}

// ── Pure helpers (unchanged) ──────────────────────────────────────────────────

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
