import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { newLine, sectionDisplayLabel } from '../db';
import LineEditor from './LineEditor';

const SECTION_TYPES = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'hook', 'middle-eight', 'custom'];

// ─── Chord transposition ──────────────────────────────────────────────────────

const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_NAMES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const NOTE_SEMITONE = {
  C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11
};

function transposeChord(chord, semitones, flats) {
  const m = chord.match(/^([A-G][#b]?)(.*)/);
  if (!m) return chord;
  const [, root, quality] = m;
  if (NOTE_SEMITONE[root] === undefined) return chord;
  const next = ((NOTE_SEMITONE[root] + semitones) % 12 + 12) % 12;
  return (flats ? FLAT_NAMES : SHARP_NAMES)[next] + quality;
}

function transposeSectionChords(section, semitones, flats) {
  return {
    ...section,
    lines: section.lines.map(l => ({
      ...l,
      chords: l.chords.map(c => ({ ...c, chord: transposeChord(c.chord, semitones, flats) })),
    })),
  };
}

function clearSectionChords(section) {
  return { ...section, lines: section.lines.map(l => ({ ...l, chords: [] })) };
}

export default function SectionBlock({ section, onUpdate, onDelete, onDuplicate, onLineSelect }) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [useFlats, setUseFlats] = useState(false);
  const [focusLineId, setFocusLineId] = useState(null);
  const menuRef = useRef(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateLine = (lineId, changes) => {
    onUpdate(section.id, {
      lines: section.lines.map(l => l.id === lineId ? { ...l, ...changes } : l),
    });
  };

  const deleteLine = (lineId) => {
    onUpdate(section.id, { lines: section.lines.filter(l => l.id !== lineId) });
  };

  const addLine = () => {
    onUpdate(section.id, { lines: [...section.lines, newLine()] });
  };

  const insertLinesAfter = (lineId, newLines) => {
    const idx = section.lines.findIndex(l => l.id === lineId);
    if (idx === -1) return;
    const lines = [...section.lines];
    lines.splice(idx + 1, 0, ...newLines);
    onUpdate(section.id, { lines });
  };

  const insertLineAfter = (lineId, newLine) => {
    insertLinesAfter(lineId, [newLine]);
    setFocusLineId(newLine.id);
  };

  const displayLabel = sectionDisplayLabel(section);

  return (
    <div ref={setNodeRef} style={style} className="section-block">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        {/* Drag handle */}
        <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="4" cy="3" r="1" fill="currentColor"/>
            <circle cx="8" cy="3" r="1" fill="currentColor"/>
            <circle cx="4" cy="6" r="1" fill="currentColor"/>
            <circle cx="8" cy="6" r="1" fill="currentColor"/>
            <circle cx="4" cy="9" r="1" fill="currentColor"/>
            <circle cx="8" cy="9" r="1" fill="currentColor"/>
          </svg>
        </span>

        {/* Label */}
        {editingLabel ? (
          <input
            autoFocus
            value={section.type === 'custom' ? section.customLabel : displayLabel}
            onChange={e => {
              if (section.type === 'custom') {
                onUpdate(section.id, { customLabel: e.target.value });
              } else {
                onUpdate(section.id, { type: 'custom', customLabel: e.target.value });
              }
            }}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--accent)',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--accent)',
              outline: 'none',
              padding: '1px 2px',
              width: '120px',
            }}
          />
        ) : (
          <span
            className="section-label-tag"
            style={{ cursor: 'text' }}
            onClick={() => setEditingLabel(true)}
            title="Click to rename"
          >
            {displayLabel}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Menu */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="2" r="1.1" fill="currentColor"/>
              <circle cx="6.5" cy="6.5" r="1.1" fill="currentColor"/>
              <circle cx="6.5" cy="11" r="1.1" fill="currentColor"/>
            </svg>
          </button>
          {showMenu && (
            <div className="popover fade-in" style={{ right: 0, top: '100%', minWidth: '160px' }}>
              <SectionTypeMenu
                current={section.type}
                onChange={type => { onUpdate(section.id, { type, customLabel: type === 'custom' ? section.customLabel : '' }); setShowMenu(false); }}
              />
              <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />

              {/* Transpose */}
              <div style={{ padding: '2px 10px 4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Transpose
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => onUpdate(section.id, transposeSectionChords(section, -1, useFlats))}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    title="Down one semitone"
                  >−1</button>
                  <button
                    onClick={() => onUpdate(section.id, transposeSectionChords(section, 1, useFlats))}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    title="Up one semitone"
                  >+1</button>
                  <button
                    onClick={() => setUseFlats(f => !f)}
                    title={useFlats ? 'Using flats — click for sharps' : 'Using sharps — click for flats'}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, padding: '3px 7px', borderRadius: '5px', border: `1px solid ${useFlats ? 'var(--accent)' : 'var(--border)'}`, background: useFlats ? 'var(--accent-glow)' : 'var(--bg-base)', color: useFlats ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}
                  >{useFlats ? '♭' : '♯'}</button>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-light)', margin: '6px 0' }} />
              <button className="type-picker-item" onClick={() => { onDuplicate(section.id); setShowMenu(false); }}>Duplicate</button>
              <button
                className="type-picker-item"
                onClick={() => { onUpdate(section.id, clearSectionChords(section)); setShowMenu(false); }}
              >Clear chords</button>
              <button
                className="type-picker-item"
                style={{ color: '#c46060' }}
                onClick={() => { onDelete(section.id); setShowMenu(false); }}
              >
                Delete section
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lines */}
      {section.lines.map(line => (
        <LineEditor
          key={line.id}
          line={line}
          onUpdate={updateLine}
          onDelete={() => deleteLine(line.id)}
          onFocus={() => onLineSelect(line.lyric)}
          onPasteLines={insertLinesAfter}
          onInsertAfter={insertLineAfter}
          shouldFocus={focusLineId === line.id}
        />
      ))}

      {/* Add line */}
      <button
        onClick={addLine}
        style={{
          display: 'block',
          marginTop: '8px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          background: 'none',
          border: 'none',
          padding: '2px 0',
          cursor: 'pointer',
        }}
      >
        + line
      </button>
    </div>
  );
}

function SectionTypeMenu({ current, onChange }) {
  return (
    <>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '2px 10px 6px' }}>
        Change type
      </div>
      {SECTION_TYPES.map(t => (
        <button
          key={t}
          className="type-picker-item"
          style={t === current ? { color: 'var(--accent)' } : {}}
          onClick={() => onChange(t)}
        >
          {t === 'pre-chorus' ? 'Pre-Chorus' : t === 'middle-eight' ? 'Middle Eight' : t.charAt(0).toUpperCase() + t.slice(1)}
          {t === current && ' ✓'}
        </button>
      ))}
    </>
  );
}
