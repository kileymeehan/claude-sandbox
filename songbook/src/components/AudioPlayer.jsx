import { useState, useRef, useEffect } from 'react';

function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ url, onRemove }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  const seek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = parseFloat(e.target.value);
  };

  const changeVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="audio-bar">
      <audio ref={audioRef} src={url} preload="metadata" />

      <button
        onClick={togglePlay}
        style={{ background: 'var(--accent)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {playing ? (
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
            <rect x="1" y="1" width="3.5" height="11" rx="0.5" fill="white"/>
            <rect x="6.5" y="1" width="3.5" height="11" rx="0.5" fill="white"/>
          </svg>
        ) : (
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
            <path d="M2 1.5l8 5-8 5v-10z" fill="white"/>
          </svg>
        )}
      </button>

      <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: '36px' }}>
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={seek}
        style={{ flex: 1 }}
      />

      <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: '36px' }}>
        {formatTime(duration)}
      </span>

      {/* Volume */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
        <path d="M2 5h2l3-2.5v9L4 9H2V5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        {volume > 0 && <path d="M9.5 4a3.5 3.5 0 010 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>}
      </svg>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={changeVolume}
        style={{ width: '64px', flexShrink: 0 }}
      />

      <button
        onClick={onRemove}
        className="icon-btn"
        title="Remove audio"
        style={{ flexShrink: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
