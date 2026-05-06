import { useState, useEffect, useCallback, useRef } from 'react';
import { saveSong, newSection, newLine, sectionDisplayLabel, getAudio, saveAudio, deleteAudio } from '../db';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import SectionBlock from './SectionBlock';
import RhymePanel from './RhymePanel';
import AudioPlayer from './AudioPlayer';
import NotesPanel from './NotesPanel';
import PrintView from './PrintView';

const SECTION_TYPES = ['verse', 'chorus', 'pre-chorus', 'bridge', 'intro', 'outro', 'hook', 'middle-eight', 'custom'];

const TYPE_LABELS = {
  verse: 'Verse', chorus: 'Chorus', 'pre-chorus': 'Pre-Chorus',
  bridge: 'Bridge', intro: 'Intro', outro: 'Outro',
  hook: 'Hook', 'middle-eight': 'Middle Eight', custom: 'Custom',
};

function detectSectionType(label) {
  const l = label.toLowerCase();
  if (l.includes('chorus')) return 'chorus';
  if (l.includes('pre-chorus') || l.includes('prechorus')) return 'pre-chorus';
  if (l.includes('bridge')) return 'bridge';
  if (l.includes('intro')) return 'intro';
  if (l.includes('outro')) return 'outro';
  if (l.includes('hook')) return 'hook';
  if (l.includes('middle') || l.includes('eight')) return 'middle-eight';
  if (l.includes('verse')) return 'verse';
  return 'verse';
}

function parseLyricsIntoSections(text) {
  // Matches: [Verse 1], (Chorus), VERSE:, Verse 1:
  const HEADER_RE = /^\[([^\]]+)\]$|^\(([^)]+)\)$|^([A-Za-z][A-Za-z\s0-9]*)\s*:$/;
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  const push = () => {
    if (current && current.lines.length > 0) sections.push(current);
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    const headerMatch = trimmed.match(HEADER_RE);

    if (headerMatch) {
      push();
      const label = (headerMatch[1] || headerMatch[2] || headerMatch[3] || '').trim();
      current = { id: crypto.randomUUID(), type: detectSectionType(label), customLabel: '', lines: [] };
    } else if (trimmed === '') {
      // Blank line = section boundary when we have content
      if (current && current.lines.length > 0) {
        push();
        current = null;
      }
    } else {
      if (!current) current = { id: crypto.randomUUID(), type: 'verse', customLabel: '', lines: [] };
      current.lines.push({ id: crypto.randomUUID(), lyric: trimmed, chords: [] });
    }
  }
  push();

  return sections;
}

export default function SongEditor({ song, albums, allTags = [], onUpdate, onDelete, onShowCircle }) {
  const [local, setLocal] = useState(song);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showRhyme, setShowRhyme] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showLyricsImport, setShowLyricsImport] = useState(false);
  const [showPasteSong, setShowPasteSong] = useState(false);
  const [selectedLineText, setSelectedLineText] = useState('');
  const saveTimer = useRef(null);
  const addSectionRef = useRef(null);

  useEffect(() => {
    getAudio(song.id).then(blob => {
      if (blob) setAudioUrl(URL.createObjectURL(blob));
    });
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [song.id]);

  useEffect(() => {
    const handler = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveSong(local).then(onUpdate);
    };
    window.addEventListener('force-save', handler);
    return () => window.removeEventListener('force-save', handler);
  }, [local, onUpdate]);

  useEffect(() => {
    const handler = (e) => {
      if (showAddSection && !addSectionRef.current?.contains(e.target)) {
        setShowAddSection(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddSection]);

  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSong(next).then(onUpdate);
    }, 500);
  }, [onUpdate]);

  const update = useCallback((changes) => {
    setLocal(prev => {
      const next = { ...prev, ...changes };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateSection = useCallback((sectionId, changes) => {
    setLocal(prev => {
      const next = { ...prev, sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...changes } : s) };
      persist(next);
      return next;
    });
  }, [persist]);

  const deleteSection = useCallback((sectionId) => {
    setLocal(prev => {
      const next = { ...prev, sections: prev.sections.filter(s => s.id !== sectionId) };
      persist(next);
      return next;
    });
  }, [persist]);

  const duplicateSection = useCallback((sectionId) => {
    setLocal(prev => {
      const idx = prev.sections.findIndex(s => s.id === sectionId);
      if (idx === -1) return prev;
      const orig = prev.sections[idx];
      const copy = {
        ...orig,
        id: crypto.randomUUID(),
        lines: orig.lines.map(l => ({ ...l, id: crypto.randomUUID(), chords: l.chords.map(c => ({ ...c, id: crypto.randomUUID() })) })),
      };
      const sections = [...prev.sections];
      sections.splice(idx + 1, 0, copy);
      const next = { ...prev, sections };
      persist(next);
      return next;
    });
  }, [persist]);

  const addSection = (type) => {
    const section = newSection(type);
    section.lines = [newLine()];
    update({ sections: [...local.sections, section] });
    setShowAddSection(false);
  };

  const handlePasteSong = (newSections) => {
    update({ sections: [...local.sections, ...newSections] });
    setShowPasteSong(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oi = local.sections.findIndex(s => s.id === active.id);
    const ni = local.sections.findIndex(s => s.id === over.id);
    update({ sections: arrayMove(local.sections, oi, ni) });
  };

  const handleAudioUpload = async (file) => {
    if (!file) return;
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    await saveAudio(local.id, blob);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(blob));
  };

  const handleAudioRemove = async () => {
    await deleteAudio(local.id);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  const handleLyricsImport = (rawLyrics) => {
    const sections = parseLyricsIntoSections(rawLyrics);
    const fallback = [{ id: crypto.randomUUID(), type: 'verse', customLabel: 'Imported Lyrics', lines: rawLyrics.split('\n').filter(Boolean).map(lyric => ({ id: crypto.randomUUID(), lyric, chords: [] })) }];
    update({ sections: [...local.sections, ...(sections.length ? sections : fallback)] });
    setShowLyricsImport(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      <div style={{ flex: 1, overflow: 'auto' }}><div style={{ padding: '40px 52px', maxWidth: '820px' }}>
        {/* Header */}
        <input
          className="song-title-input"
          value={local.title}
          onChange={e => update({ title: e.target.value })}
          placeholder="Song title"
          style={{ marginBottom: '16px' }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span className={`badge ${local.type === 'original' ? 'badge-original' : 'badge-cover'}`}>
            {local.type === 'original' ? 'Original' : 'Cover'}
          </span>
          <button
            onClick={() => update({ type: local.type === 'original' ? 'cover' : 'original' })}
            style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', padding: '2px 4px', textDecoration: 'underline' }}
          >
            change
          </button>

          {local.type === 'cover' && (
            <input
              value={local.artist}
              onChange={e => update({ artist: e.target.value })}
              placeholder="Original artist"
              style={{ fontSize: '14px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', padding: '2px 4px' }}
            />
          )}

          <select value={local.albumId || ''} onChange={e => update({ albumId: e.target.value || null })}>
            <option value="">No album</option>
            {albums.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>

        <TagInput
          tags={local.tags || []}
          allTags={allTags}
          onChange={tags => update({ tags })}
        />

        {audioUrl && <AudioPlayer url={audioUrl} onRemove={handleAudioRemove} />}

        {!audioUrl && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 0', marginBottom: '8px' }}>
            <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleAudioUpload(e.target.files[0])} />
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v7M3.5 5.5l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Attach audio
          </label>
        )}

        <div className="divider" />

        {/* Sections */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={local.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {local.sections.map(section => (
              <SectionBlock
                key={section.id}
                section={section}
                onUpdate={updateSection}
                onDelete={deleteSection}
                onDuplicate={duplicateSection}
                onLineSelect={setSelectedLineText}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Scratch pad for new/empty songs */}
        {local.sections.length === 0 && (
          <ScratchPad onSections={(s) => update({ sections: s })} />
        )}

        {/* Add section + Paste full song (only when song has content) */}
        {local.sections.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'inline-block' }} ref={addSectionRef}>
              <button
                className="btn"
                onClick={() => setShowAddSection(!showAddSection)}
                style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Add section
              </button>
              {showAddSection && (
                <div className="type-picker fade-in">
                  {SECTION_TYPES.map(t => (
                    <button key={t} className="type-picker-item" onClick={() => addSection(t)}>
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn"
              onClick={() => setShowPasteSong(true)}
              style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2.5" width="7" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3.5 1h5.5a1 1 0 011 1v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M3 5.5h4.5M3 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              Paste full song
            </button>
          </div>
        )}

        {local.type === 'cover' && (
          <div style={{ marginTop: '24px', padding: '14px 16px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Chords:</strong> No free API exists for chord data.
              Reference <a href="https://www.ultimate-guitar.com" target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ultimate Guitar</a> or{' '}
              <a href="https://chordify.net" target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Chordify</a> and add chords manually.
            </p>
          </div>
        )}

        <div style={{ height: '40px' }} />
      </div></div>

      {showRhyme && (
        <RhymePanel
          defaultWord={selectedLineText.split(/\s+/).filter(Boolean).pop() || ''}
          onClose={() => setShowRhyme(false)}
        />
      )}

      {showNotes && (
        <NotesPanel
          notes={local.notes || ''}
          images={local.moodImages || []}
          onNotesChange={notes => update({ notes })}
          onImagesChange={moodImages => update({ moodImages })}
          onClose={() => setShowNotes(false)}
        />
      )}
      </div>

      {/* Persistent toolbar */}
      <div className="editor-toolbar">
        <button
          className={`btn ${showRhyme ? 'btn-accent' : ''}`}
          onClick={() => setShowRhyme(r => !r)}
          style={{ fontSize: '12px', padding: '5px 12px' }}
        >Rhyme</button>
        <button className="btn" onClick={onShowCircle} style={{ fontSize: '12px', padding: '5px 12px' }}>
          Circle of fifths
        </button>
        <button
          className={`btn ${showNotes ? 'btn-accent' : ''}`}
          onClick={() => setShowNotes(n => !n)}
          style={{ fontSize: '12px', padding: '5px 12px' }}
        >Notes</button>
        {local.type === 'cover' && (
          <button className="btn" onClick={() => setShowLyricsImport(true)} style={{ fontSize: '12px', padding: '5px 12px' }}>
            Import lyrics
          </button>
        )}
        <button
          className={`btn ${showPrint ? 'btn-accent' : ''}`}
          onClick={() => setShowPrint(true)}
          style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="4" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 4V2.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V4" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 8.5h5M3.5 6.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          Print
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { if (confirm(`Delete "${local.title}"?`)) onDelete(); }}
          style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', padding: '5px 8px' }}
        >Delete song</button>
      </div>

      {showLyricsImport && (
        <LyricsImport
          artist={local.artist}
          title={local.title}
          onImport={handleLyricsImport}
          onClose={() => setShowLyricsImport(false)}
        />
      )}

      {showPasteSong && (
        <FullSongPaste
          onConfirm={handlePasteSong}
          onClose={() => setShowPasteSong(false)}
        />
      )}

      {showPrint && (
        <PrintView
          song={local}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

// ─── Scratch Pad ─────────────────────────────────────────────────────────────

function ScratchPad({ onSections }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);

  // Auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [text]);

  const commit = (value) => {
    const v = (value ?? text).trim();
    if (!v) return;
    const sections = parseLyricsIntoSections(v);
    if (sections.length) onSections(sections);
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes('\n')) return;
    e.preventDefault();
    const combined = text.trim() ? text.trimEnd() + '\n' + pasted : pasted;
    commit(combined);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  };

  return (
    <div style={{ paddingTop: '4px' }}>
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
        placeholder="Start writing, or paste your full lyrics…"
        style={{
          width: '100%',
          minHeight: '160px',
          background: 'transparent',
          border: 'none',
          fontSize: '19px',
          fontFamily: 'var(--font-serif)',
          color: 'var(--text-primary)',
          lineHeight: '1.75',
          resize: 'none',
          padding: '0',
          outline: 'none',
          display: 'block',
          overflow: 'hidden',
        }}
      />
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', opacity: 0.6 }}>
        Paste to auto-split into sections · ⌘↵ to structure what you've typed
      </p>
    </div>
  );
}

// ─── Tag Input ───────────────────────────────────────────────────────────────

function TagInput({ tags, allTags, onChange }) {
  const [inputVal, setInputVal] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const suggestions = allTags.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(inputVal.toLowerCase().trim())
  );

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setInputVal('');
    setShowSuggestions(false);
  };

  const removeTag = (tag) => onChange(tags.filter(t => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ marginBottom: '10px', position: 'relative' }}>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          minHeight: '32px', padding: '4px 0',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map(tag => (
          <span
            key={tag}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              fontSize: '11px', fontWeight: 500,
              padding: '3px 8px', borderRadius: '20px',
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
          >
            {tag}
            <button
              onClick={e => { e.stopPropagation(); removeTag(tag); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: '0 0 0 2px', lineHeight: 1, fontSize: '13px', cursor: 'pointer', opacity: 0.7 }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          placeholder={tags.length === 0 ? 'Add tags…' : ''}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '12px', color: 'var(--text-secondary)',
            padding: '2px 4px', minWidth: '80px', flex: 1,
          }}
        />
      </div>
      {showSuggestions && (inputVal.trim() || suggestions.length > 0) && (
        <div
          className="popover fade-in"
          style={{ top: '100%', left: 0, minWidth: '160px', zIndex: 150 }}
        >
          {inputVal.trim() && !tags.includes(inputVal.trim().toLowerCase()) && (
            <button
              className="type-picker-item"
              onMouseDown={() => addTag(inputVal)}
            >
              Add "<strong>{inputVal.trim()}</strong>"
            </button>
          )}
          {suggestions.map(s => (
            <button
              key={s}
              className="type-picker-item"
              onMouseDown={() => addTag(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full Song Paste Modal ────────────────────────────────────────────────────

function FullSongPaste({ onConfirm, onClose }) {
  const [step, setStep] = useState('input'); // 'input' | 'preview'
  const [raw, setRaw] = useState('');
  const [sections, setSections] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (step === 'input' && textareaRef.current) textareaRef.current.focus();
  }, [step]);

  const handleParse = () => {
    const parsed = parseLyricsIntoSections(raw.trim());
    if (!parsed.length) return;
    setSections(parsed);
    setStep('preview');
  };

  const updateType = (id, type) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, type, customLabel: '' } : s));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box fade-in"
        onClick={e => e.stopPropagation()}
        style={{ width: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {step === 'input' ? 'Paste full song' : `${sections.length} section${sections.length !== 1 ? 's' : ''} found`}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {step === 'input'
                ? 'Blank lines or headers like [Chorus] will be used to split sections.'
                : 'Check the section types, then confirm to add them to your song.'}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {step === 'input' && (
            <textarea
              ref={textareaRef}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={`Paste lyrics here…\n\n[Verse 1]\nLine one\nLine two\n\n[Chorus]\nRefrain line\n\nOr just paste plain text — blank lines will create sections.`}
              style={{
                width: '100%',
                minHeight: '320px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '14px 16px',
                fontSize: '15px',
                fontFamily: 'var(--font-serif)',
                color: 'var(--text-primary)',
                lineHeight: 1.75,
                resize: 'vertical',
              }}
            />
          )}

          {step === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sections.map((section, i) => (
                <SectionPreviewRow
                  key={section.id}
                  section={section}
                  index={i}
                  onTypeChange={(type) => updateType(section.id, type)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexShrink: 0 }}>
          {step === 'preview' && (
            <button className="btn" onClick={() => setStep('input')}>← Back</button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          {step === 'input' ? (
            <button
              className="btn btn-accent"
              onClick={handleParse}
              disabled={!raw.trim()}
            >
              Parse sections →
            </button>
          ) : (
            <button
              className="btn btn-accent"
              onClick={() => onConfirm(sections)}
            >
              Add to song
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionPreviewRow({ section, index, onTypeChange }) {
  const [open, setOpen] = useState(false);
  const preview = section.lines.slice(0, 2).map(l => l.lyric).join(' / ');
  const overflow = section.lines.length > 2 ? ` + ${section.lines.length - 2} more` : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        padding: '10px 12px',
        borderRadius: '7px',
        background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        position: 'relative',
      }}
    >
      {/* Type selector */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--accent)',
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            padding: '3px 8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            minWidth: '80px',
            textAlign: 'center',
          }}
        >
          {TYPE_LABELS[section.type]} ▾
        </button>
        {open && (
          <div className="type-picker fade-in" style={{ minWidth: '140px' }}>
            {SECTION_TYPES.map(t => (
              <button
                key={t}
                className="type-picker-item"
                style={t === section.type ? { color: 'var(--accent)' } : {}}
                onClick={() => { onTypeChange(t); setOpen(false); }}
              >
                {TYPE_LABELS[t]}{t === section.type ? ' ✓' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lines preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {preview}
          {overflow && <span style={{ color: 'var(--text-muted)' }}>{overflow}</span>}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {section.lines.length} line{section.lines.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Lyrics Import (covers) ───────────────────────────────────────────────────

function LyricsImport({ artist, title, onImport, onClose }) {
  const [searchArtist, setSearchArtist] = useState(artist || '');
  const [searchTitle, setSearchTitle] = useState(title || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState('');

  const fetchLyrics = async () => {
    if (!searchArtist.trim() || !searchTitle.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(searchArtist)}/${encodeURIComponent(searchTitle)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setFetched(data.lyrics || '');
    } catch {
      setError("Lyrics not found. The service may be unavailable or the song isn't in the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>
          Import Lyrics
        </h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <input value={searchArtist} onChange={e => setSearchArtist(e.target.value)} placeholder="Artist"
            style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }} />
          <input value={searchTitle} onChange={e => setSearchTitle(e.target.value)} placeholder="Song title"
            style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', fontSize: '14px' }}
            onKeyDown={e => e.key === 'Enter' && fetchLyrics()} />
          <button className="btn btn-accent" onClick={fetchLyrics} disabled={loading} style={{ flexShrink: 0 }}>
            {loading ? '…' : 'Fetch'}
          </button>
        </div>
        {error && <p style={{ color: '#c46060', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        {fetched && (
          <>
            <textarea value={fetched} onChange={e => setFetched(e.target.value)}
              style={{ width: '100%', height: '240px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '14px', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'var(--font-serif)', lineHeight: 1.7 }} />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '16px', fontStyle: 'italic' }}>
              Lyrics imported — please verify accuracy and respect copyright.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-accent" onClick={() => onImport(fetched)}>Add to song</button>
            </div>
          </>
        )}
        {!fetched && !error && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
