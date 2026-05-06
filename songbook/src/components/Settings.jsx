import { FONTS } from '../fonts';

const PREVIEW_TITLE = 'These foolish things';
const PREVIEW_LYRIC = 'A tinkling piano in the next apartment';

export default function Settings({ font, onFontChange, theme, onToggleTheme }) {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}><div style={{ padding: '48px 52px', maxWidth: '680px' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '32px', marginTop: 0 }}>
        Settings
      </h2>

      {/* Theme */}
      <Section label="Appearance">
        <div style={{ display: 'flex', gap: '10px' }}>
          {['dark', 'light'].map(t => (
            <button
              key={t}
              onClick={() => theme !== t && onToggleTheme()}
              style={{
                padding: '8px 18px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: 500,
                border: `1px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`,
                background: theme === t ? 'var(--accent-glow)' : 'transparent',
                color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {t === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>
      </Section>

      <div className="divider" />

      {/* Font picker */}
      <Section label="Lyric font">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {FONTS.map(f => {
            const active = font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onFontChange(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  borderRadius: '9px',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: active ? 'var(--accent-glow)' : 'var(--bg-surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.12s, background 0.12s',
                  width: '100%',
                }}
              >
                {/* Active dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: active ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.12s',
                }} />

                {/* Preview text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: f.family,
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.3,
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {PREVIEW_TITLE}
                  </div>
                  <div style={{
                    fontFamily: f.family,
                    fontSize: '13px',
                    fontStyle: 'italic',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {PREVIEW_LYRIC}
                  </div>
                </div>

                {/* Label */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {f.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="divider" />

      <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.7 }}>
        All songbook data is stored locally in your browser (IndexedDB). Nothing is sent to any server.
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
        Shortcuts: <strong style={{ color: 'var(--text-secondary)' }}>⌘K</strong> quick search &nbsp;·&nbsp;
        <strong style={{ color: 'var(--text-secondary)' }}>⌘S</strong> force save
      </p>
    </div></div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px', marginTop: 0 }}>
        {label}
      </p>
      {children}
    </div>
  );
}
