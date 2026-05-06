import { useState, useRef, useEffect, useCallback } from 'react';
import { newChord } from '../db';

export default function LineEditor({ line, onUpdate, onDelete, onFocus, onPasteLines, onInsertAfter, shouldFocus }) {
  const [showChordInput, setShowChordInput] = useState(false);
  const [chordPos, setChordPos] = useState(0);
  const [chordPixelX, setChordPixelX] = useState(0);
  const [chordValue, setChordValue] = useState('');
  const [editingChordId, setEditingChordId] = useState(null);
  const [pickerRoot, setPickerRoot] = useState('');
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

  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, [shouldFocus]);

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
    setPickerRoot('');
    setShowChordInput(true);
  };

  const handleChordClick = (e, chord) => {
    e.stopPropagation();
    const pixX = getPixelXForChar(chord.position);
    setChordPos(chord.position);
    setChordPixelX(pixX);
    setChordValue(chord.chord);
    setEditingChordId(chord.id);
    setPickerRoot('');
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
        <ChordPopover
          chordInputRef={chordInputRef}
          chordValue={chordValue}
          setChordValue={setChordValue}
          pickerRoot={pickerRoot}
          setPickerRoot={setPickerRoot}
          editingChordId={editingChordId}
          pixelX={chordPixelX}
          onCommit={commitChord}
          onRemove={removeChord}
          onClose={() => setShowChordInput(false)}
          onPickChord={(chord) => {
            setChordValue(chord);
            // commit inline without going through state flush delay
            const isEditing = editingChordId;
            if (isEditing) {
              onUpdate(line.id, {
                chords: line.chords.map(c => c.id === isEditing ? { ...c, chord } : c),
              });
            } else {
              const existing = line.chords.find(c => Math.abs(c.position - chordPos) < 2);
              if (existing) {
                onUpdate(line.id, {
                  chords: line.chords.map(c => c.id === existing.id ? { ...c, chord } : c),
                });
              } else {
                onUpdate(line.id, { chords: [...line.chords, newChord(chord, chordPos)] });
              }
            }
            setShowChordInput(false);
          }}
        />
      )}

      {/* Lyric input (below chord popover) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <textarea
          ref={textareaRef}
          className="lyric-input"
          value={line.lyric}
          onChange={e => onUpdate(line.id, { lyric: e.target.value })}
          onPaste={handlePaste}
          onFocus={() => onFocus && onFocus()}
          onKeyDown={e => {
            if (e.key === 'Backspace' && line.lyric === '') {
              e.preventDefault();
              onDelete();
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const cursor = textareaRef.current.selectionStart;
              const before = line.lyric.slice(0, cursor);
              const after = line.lyric.slice(cursor);
              const chordsKept = line.chords.filter(c => c.position <= cursor);
              const chordsMoving = line.chords
                .filter(c => c.position > cursor)
                .map(c => ({ ...c, id: crypto.randomUUID(), position: c.position - cursor }));
              onUpdate(line.id, { lyric: before, chords: chordsKept });
              onInsertAfter(line.id, { id: crypto.randomUUID(), lyric: after, chords: chordsMoving });
            }
          }}
          placeholder="Write a line…"
          rows={1}
          style={{ flex: 1 }}
        />
        <button
          className="icon-btn"
          onClick={onDelete}
          style={{
            opacity: line.lyric === '' ? 0.5 : 0,
            transition: 'opacity 0.1s',
            marginTop: '4px',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = line.lyric === '' ? '0.5' : '0'}
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

// ─── Chord Popover ────────────────────────────────────────────────────────────

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITIES = [
  { label: 'maj', value: '' },
  { label: 'm', value: 'm' },
  { label: '7', value: '7' },
  { label: 'maj7', value: 'maj7' },
  { label: 'm7', value: 'm7' },
  { label: 'sus2', value: 'sus2' },
  { label: 'sus4', value: 'sus4' },
  { label: 'dim', value: 'dim' },
  { label: 'aug', value: 'aug' },
  { label: 'add9', value: 'add9' },
  { label: '9', value: '9' },
  { label: '6', value: '6' },
];

function ChordPopover({ chordInputRef, chordValue, setChordValue, pickerRoot, setPickerRoot, editingChordId, pixelX, onCommit, onRemove, onClose, onPickChord }) {
  return (
    <div
      className="popover fade-in"
      style={{ left: Math.max(0, pixelX - 20), top: '-2px', zIndex: 120, width: '232px' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {editingChordId ? 'Edit chord' : 'Add chord'}
      </div>

      {/* Free-text input */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <input
          ref={chordInputRef}
          value={chordValue}
          onChange={e => { setChordValue(e.target.value); setPickerRoot(''); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="e.g. Am, G7, Cmaj7"
          style={{
            flex: 1,
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            padding: '5px 9px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button className="btn btn-accent" onClick={onCommit} style={{ fontSize: '12px', padding: '4px 10px', flexShrink: 0 }}>Set</button>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>or pick</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
      </div>

      {/* Root note grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '8px' }}>
        {ROOTS.map(root => (
          <button
            key={root}
            onMouseDown={() => {
              setPickerRoot(root);
              setChordValue(root);
            }}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '5px 0',
              borderRadius: '5px',
              border: `1px solid ${pickerRoot === root ? 'var(--accent)' : 'var(--border)'}`,
              background: pickerRoot === root ? 'var(--accent-glow)' : 'var(--bg-base)',
              color: pickerRoot === root ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.1s',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {root}
          </button>
        ))}
      </div>

      {/* Quality row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '10px' }}>
        {QUALITIES.map(q => (
          <button
            key={q.label}
            onMouseDown={() => {
              const chord = (pickerRoot || chordValue.replace(/m.*|7.*|sus.*|dim|aug|add.*|maj.*|[0-9].*/g, '') || '') + q.value;
              if (chord) onPickChord(chord);
            }}
            style={{
              fontSize: '10px',
              fontWeight: 500,
              padding: '4px 0',
              borderRadius: '5px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-secondary)',
              cursor: pickerRoot ? 'pointer' : 'default',
              opacity: pickerRoot ? 1 : 0.45,
              transition: 'all 0.1s',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Remove / close */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {editingChordId && (
          <button className="btn" onClick={onRemove} style={{ fontSize: '12px', padding: '4px 10px', color: '#c46060', borderColor: 'transparent' }}>Remove</button>
        )}
        <button className="btn" onClick={onClose} style={{ fontSize: '12px', padding: '4px 10px', marginLeft: 'auto' }}>✕</button>
      </div>
    </div>
  );
}
