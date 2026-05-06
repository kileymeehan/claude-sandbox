import { useEffect } from 'react';

function buildChordLine(lyric, chords) {
  if (!chords?.length) return null;
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  let out = '';
  for (const { chord, position } of sorted) {
    while (out.length < position) out += ' ';
    if (out.length > position && !out.endsWith(' ')) out += ' ';
    out += chord;
  }
  return out || null;
}

function sectionLabel(section) {
  if (section.type === 'custom') return section.customLabel || 'Section';
  return {
    verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge',
    'pre-chorus': 'Pre-Chorus', 'middle-eight': 'Middle Eight',
    outro: 'Outro', intro: 'Intro', hook: 'Hook',
  }[section.type] ?? section.type;
}

export default function PrintView({ song, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasChords = song.sections.some(s => s.lines.some(l => l.chords?.length > 0));

  return (
    <div className="print-overlay">

      {/* Screen chrome — hidden in print */}
      <div className="print-overlay-chrome">
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
          Print preview
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-accent" style={{ fontSize: '13px' }} onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button className="btn" style={{ fontSize: '13px' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Page */}
      <div className="print-content">

        {/* Song header */}
        <div style={{ marginBottom: '28px', paddingBottom: '18px', borderBottom: '2px solid #1a1a1a' }}>
          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 700,
            color: '#1a1a1a',
            margin: '0 0 8px',
            lineHeight: 1.15,
          }}>
            {song.title || 'Untitled'}
          </h1>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#555', fontFamily: 'var(--font-sans)' }}>
            {song.artist && <span>{song.artist}</span>}
            <span style={{ textTransform: 'capitalize' }}>{song.type}</span>
            {song.tags?.length > 0 && <span>{song.tags.join(' · ')}</span>}
            {hasChords && (
              <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#888' }}>
                chords shown above lyrics
              </span>
            )}
          </div>
        </div>

        {/* Sections */}
        <div style={{ columns: song.sections.length > 4 ? '2' : '1', columnGap: '40px' }}>
          {song.sections.map((section, si) => (
            <div
              key={section.id}
              style={{
                breakInside: 'avoid',
                marginBottom: '28px',
              }}
            >
              {/* Section label */}
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#888',
                marginBottom: '10px',
                paddingBottom: '4px',
                borderBottom: '1px solid #ddd',
              }}>
                {sectionLabel(section)}
              </div>

              {/* Lines */}
              {section.lines.map(line => {
                const chordLine = buildChordLine(line.lyric, line.chords);
                return (
                  <div key={line.id} style={{ marginBottom: chordLine ? '10px' : '1px' }}>
                    {chordLine && (
                      <div style={{
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: '11.5px',
                        fontWeight: 700,
                        whiteSpace: 'pre',
                        color: '#b84020',
                        lineHeight: 1.2,
                        letterSpacing: '0.02em',
                      }}>
                        {chordLine}
                      </div>
                    )}
                    <div style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '14px',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      color: '#1a1a1a',
                    }}>
                      {line.lyric || ' '}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Notes — only printed if there's content */}
        {song.notes?.trim() && (
          <div style={{ marginTop: '36px', paddingTop: '18px', borderTop: '1px solid #ddd' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#888', marginBottom: '10px' }}>
              Notes
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#444', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {song.notes}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
