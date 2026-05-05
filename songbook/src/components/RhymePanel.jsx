import { useState, useEffect, useRef } from 'react';

export default function RhymePanel({ defaultWord, onClose }) {
  const [word, setWord] = useState(defaultWord || '');
  const [perfect, setPerfect] = useState([]);
  const [near, setNear] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (defaultWord) {
      setWord(defaultWord);
    }
  }, [defaultWord]);

  const search = async (searchWord = word) => {
    const w = searchWord.trim().toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return;
    setLoading(true);
    setSearched(true);
    try {
      const [perfectRes, nearRes] = await Promise.all([
        fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(w)}&max=30`).then(r => r.json()),
        fetch(`https://api.datamuse.com/words?rel_nry=${encodeURIComponent(w)}&max=30`).then(r => r.json()),
      ]);
      setPerfect(perfectRes.map(r => r.word));
      setNear(nearRes.map(r => r.word).filter(w => !perfectRes.some(p => p.word === w)));
    } catch {
      setPerfect([]);
      setNear([]);
    } finally {
      setLoading(false);
    }
  };

  const copyWord = (w) => {
    navigator.clipboard.writeText(w).then(() => {
      setCopied(w);
      setTimeout(() => setCopied(null), 1400);
    });
  };

  return (
    <div className="rhyme-panel fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
          Rhyme Assistant
        </span>
        <button className="icon-btn" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '14px 14px 10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={inputRef}
            value={word}
            onChange={e => setWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Rhyme this word…"
            style={{
              flex: 1,
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '7px 10px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
            }}
          />
          <button className="btn btn-accent" onClick={() => search()} disabled={loading} style={{ padding: '7px 12px', flexShrink: 0 }}>
            {loading ? '…' : 'Go'}
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '7px', lineHeight: 1.5 }}>
          Click a word to copy. Powered by Datamuse.
        </p>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 16px' }}>
        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>Searching…</div>
        )}

        {!loading && searched && perfect.length === 0 && near.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0', textAlign: 'center', fontStyle: 'italic' }}>
            No rhymes found for "{word}"
          </div>
        )}

        {!loading && perfect.length > 0 && (
          <RhymeGroup label="Perfect rhymes" words={perfect} copied={copied} onCopy={copyWord} />
        )}

        {!loading && near.length > 0 && (
          <RhymeGroup label="Near rhymes" words={near} copied={copied} onCopy={copyWord} />
        )}
      </div>
    </div>
  );
}

function RhymeGroup({ label, words, copied, onCopy }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {words.map(w => (
          <button
            key={w}
            onClick={() => onCopy(w)}
            style={{
              background: copied === w ? 'var(--accent-glow)' : 'var(--bg-elevated)',
              border: `1px solid ${copied === w ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '5px',
              padding: '4px 9px',
              fontSize: '13px',
              color: copied === w ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.1s',
              fontFamily: 'var(--font-serif)',
            }}
            onMouseEnter={e => { if (copied !== w) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}}
            onMouseLeave={e => { if (copied !== w) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
