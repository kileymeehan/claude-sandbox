import { useState, useRef, useEffect, useCallback } from 'react';
import { newChord } from '../db';

export default function LineEditor({ line, onUpdate, onDelete, onFocus, onPasteLines }) {
  const [showChordInput, setShowChordInput] = useState(false);
  const [chordPos, setChordPos] = useState(0);
  const [chordPixelX, setChordPixelX] = useState(0);
  const [chordValue, setChordValue] = useState('');
  const [editingChordId, setEditingChordId] = useState(null);
  const textareaRef = useRef(null);
  const mirrorRef = useRef(null);
  const chordInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (showChordInput && chordInputRef.current) {
      chordInputRef.current.focus();
    }
  }, [showChordInput]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [line.lyric]);

  const getCharPositionFromX = useCallback((x) => {
    const mirror = mirrorRef.current;
    if (!mirror || !line.lyric) return 0;
    let lo = 0, hi = line.lyric.length;
    const mirrorRect = mirror.getBoundingClientRect();
    const relX = x - mirrorRect.left;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const range = document.createRange();
      const node = mirror.firstChild;
      if (!node) break;
      try {
        range.setStart(node, 0);
        range.setEnd(node, mid);
        const rect = range.getBoundingClientRect();
        if (rect.right - mirrorRect.left < relX) lo = mid + 1;
        else hi = mid;
      } catch { break; }
    }
    return lo;
  }, [line.lyric]);

  const getPixelXForChar = useCallback((pos) => {
    const mirror = mirrorRef.current;
    if (!mirror) return 0;
    const node = mirror.firstChild;
    if (!node || !line.lyric) return 0;
    try {
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(pos, line.lyric.length));
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      return rect.right - (containerRect?.left ?? 0);
    } catch {
      return 0;
    }
  }, [line.lyric]);

  const handleChordRowClick = (e) => {
    const pos = getCharPositionFromX(e.clientX);
    const pixX = getPixelXForChar(pos);
    setChordPos(pos);
    setChordPixelX(pixX);
    setChordValue('');
    setEditingChordId(null);
    setShowChordInput(true);
  };

  const handleChordClick = (e, chord) => {
    e.stopPropagation();
    const pixX = getPixelXForChar(chord.position);
    setChordPos(chord.position);
    setChordPixelX(pixX);
    setChordValue(chord.chord);
    setEditingChordId(chord.id);
    setShowChordInput(true);
  };

  const commitChord = () => {
    if (!chordValue.trim()) {
      if (editingChordId) {
        onUpdate(line.id, { chords: line.chords.filter(c => c.id !== editingChordId) });
      }
      setShowChordInput(false);
      return;
    }
    if (editingChordId) {
      onUpdate(line.id, {
        chords: line.chords.map(c => c.id === editingChordId ? { ...c, chord: chordValue.trim() } : c),
      });
    } else {
      const existing = line.chords.find(c => Math.abs(c.position - chordPos) < 2);
      if (existing) {
        onUpdate(line.id, {
          chords: line.chords.map(c => c.id === existing.id ? { ...c, chord: chordValue.trim() } : c),
        });
      } else {
        onUpdate(line.id, { chords: [...line.chords, newChord(chordValue.trim(), chordPos)] });
      }
    }
    setShowChordInput(false);
  };

  const removeChord = () => {
    if (editingChordId) {
      onUpdate(line.id, { chords: line.chords.filter(c => c.id !== editingChordId) });
    }
    setShowChordInput(false);
  };

  // Split pasted multi-line text into separate line entries
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n')) return; // let single-line paste happen normally

    e.preventDefault();
    const ta = textareaRef.current;
    const before = line.lyric.slice(0, ta.selectionStart);
    const after = line.lyric.slice(ta.selectionEnd);
    const parts = text.split('\n');

    // First part merges with whatever was already on this line
    onUpdate(line.id, { lyric: before + parts[0] + (parts.length === 1 ? after : '') });

    // Remaining parts become new lines; last one gets the tail of the existing lyric
    if (parts.length > 1 && onPasteLines) {
      const newLines = parts.slice(1).map((lyric, i) => ({
        id: crypto.randomUUID(),
        lyric: i === parts.length - 2 ? lyric + after : lyric,
        chords: [],
      }));
      onPasteLines(line.id, newLines);
    }
  };

  const hasChords = line.chords.length > 0;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', marginBottom: '4px' }}
    >
      {/* Hidden mirror for text measurement */}
      <span ref={mirrorRef} className="lyric-mirror" aria-hidden="true">
        {line.lyric || ''}
      </span>

      {/* Chord row — always takes up space so lyric never jumps */}
      <div
        className="chord-row-wrap"
        onClick={handleChordRowClick}
        title="Click to add a chord"
      >
        {line.chords
          .slice()
          .sort((a, b) => a.position - b.position)
          .map(chord => (
            <span
              key={chord.id}
              className="chord-chip"
              style={{ left: `${getPixelXForChar(chord.position)}px` }}
              onClick={e => handleChordClick(e, chord)}
              title="Click to edit"
            >
              {chord.chord}
            </span>
          ))}
        {!hasChords && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.35, paddingLeft: '2px', pointerEvents: 'none' }}>
            + chord
          </span>
        )}
      </div>

      {/* Chord input popover */}
      {showChordInput && (
        <div
          className="popover fade-in"
          style={{ left: Math.max(0, chordPixelX - 20), top: '-2px', zIndex: 120 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {editingChordId ? 'Edit chord' : 'Add chord'}
          </div>
          <input
            ref={chordInputRef}
            value={chordValue}
            onChange={e => setChordValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitChord(); }
              if (e.key === 'Escape') setShowChordInput(false);
            }}
            placeholder="e.g. Am, G7, Cmaj7"
            style={{
              width: '130px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '5px',
              padding: '5px 9px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button className="btn btn-accent" onClick={commitChord} style={{ fontSize: '12px', padding: '4px 10px' }}>Set</button>
            {editingChordId && (
              <button className="btn" onClick={removeChord} style={{ fontSize: '12px', padding: '4px 10px', color: '#c46060', borderColor: 'transparent' }}>Remove</button>
            )}
            <button className="btn" onClick={() => setShowChordInput(false)} style={{ fontSize: '12px', padding: '4px 10px' }}>✕</button>
          </div>
        </div>
      )}

      {/* Lyric input */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <textarea
          ref={textareaRef}
          className="lyric-input"
          value={line.lyric}
          onChange={e => onUpdate(line.id, { lyric: e.target.value })}
          onPaste={handlePaste}
          onFocus={() => onFocus && onFocus()}
          placeholder="Write a line…"
          rows={1}
          style={{ flex: 1 }}
        />
        <button
          className="icon-btn"
          onClick={onDelete}
          style={{ opacity: 0, transition: 'opacity 0.1s', marginTop: '4px' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          title="Delete line"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
