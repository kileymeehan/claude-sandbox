const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯/G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F'];
const MINOR_KEYS = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'E♭m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm'];

export default function CircleOfFifths({ onClose }) {
  const cx = 200, cy = 200;
  const outerR = 155, innerR = 108, centerR = 65;
  const sliceAngle = 360 / 12;

  function polarToXY(angleDeg, r) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function slicePath(i, outer, inner) {
    const startAngle = i * sliceAngle - sliceAngle / 2;
    const endAngle = startAngle + sliceAngle;
    const [x1, y1] = polarToXY(startAngle, outer);
    const [x2, y2] = polarToXY(endAngle, outer);
    const [x3, y3] = polarToXY(endAngle, inner);
    const [x4, y4] = polarToXY(startAngle, inner);
    return `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
  }

  function labelPos(i, r) {
    const angle = i * sliceAngle;
    return polarToXY(angle, r);
  }

  const majorColors = [
    '#c4583a','#c46040','#b85840','#a85040','#984840','#8a4438',
    '#7a4038','#6e4040','#644448','#5c484c','#5c4858','#644858',
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box fade-in"
        onClick={e => e.stopPropagation()}
        style={{ padding: '28px', width: '460px', maxWidth: '94vw' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Circle of Fifths
          </h3>
          <button className="icon-btn" onClick={onClose}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="400" height="400" viewBox="0 0 400 400">
            {/* Outer ring — major keys */}
            {MAJOR_KEYS.map((key, i) => {
              const [lx, ly] = labelPos(i, (outerR + innerR) / 2);
              const alpha = 0.65 + (i % 3) * 0.1;
              return (
                <g key={key}>
                  <path
                    d={slicePath(i, outerR, innerR)}
                    fill={majorColors[i]}
                    fillOpacity={alpha}
                    stroke="var(--bg-base)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#fff"
                    fontSize={key.includes('/') ? '9' : '13'}
                    fontFamily="'Playfair Display', Georgia, serif"
                    fontWeight="700"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {key}
                  </text>
                </g>
              );
            })}

            {/* Inner ring — relative minors */}
            {MINOR_KEYS.map((key, i) => {
              const [lx, ly] = labelPos(i, (innerR + centerR) / 2);
              return (
                <g key={key}>
                  <path
                    d={slicePath(i, innerR, centerR)}
                    fill={majorColors[i]}
                    fillOpacity={0.28}
                    stroke="var(--bg-base)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--text-secondary)"
                    fontSize="11"
                    fontFamily="'Inter', system-ui, sans-serif"
                    fontWeight="500"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {key}
                  </text>
                </g>
              );
            })}

            {/* Center */}
            <circle cx={cx} cy={cy} r={centerR} fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1.5"/>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="'Inter', sans-serif" fontWeight="600" style={{ userSelect: 'none' }}>
              CIRCLE
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="'Inter', sans-serif" fontWeight="600" style={{ userSelect: 'none' }}>
              OF FIFTHS
            </text>
          </svg>
        </div>

        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--accent)', opacity: 0.85 }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Major keys</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'var(--accent)', opacity: 0.28 }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Relative minors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
