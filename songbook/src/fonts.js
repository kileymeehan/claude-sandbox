export const FONTS = [
  {
    id: 'playfair',
    label: 'Playfair Display',
    description: 'Classic editorial serif',
    family: "'Playfair Display', Georgia, serif",
    googleUrl: null, // already loaded in index.html
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    description: 'Refined · Mrs Eaves style',
    family: "'Cormorant Garamond', Georgia, serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap',
  },
  {
    id: 'bodoni',
    label: 'Bodoni Moda',
    description: 'High-contrast Bodoni',
    family: "'Bodoni Moda', Georgia, serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;1,6..96,400&display=swap',
  },
  {
    id: 'lora',
    label: 'Lora',
    description: 'Warm literary serif',
    family: "'Lora', Georgia, serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap',
  },
  {
    id: 'imfell',
    label: 'IM Fell English',
    description: 'Old-style romantic',
    family: "'IM Fell English', Georgia, serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap',
  },
  {
    id: 'dmsans',
    label: 'DM Sans',
    description: 'Clean sans-serif',
    family: "'DM Sans', system-ui, sans-serif",
    googleUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap',
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    description: 'Monospace',
    family: "'JetBrains Mono', 'Courier New', monospace",
    googleUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;1,400&display=swap',
  },
];

export function applyFont(fontId) {
  const font = FONTS.find(f => f.id === fontId);
  if (!font) return;
  if (font.googleUrl && !document.querySelector(`link[data-font="${fontId}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.googleUrl;
    link.setAttribute('data-font', fontId);
    document.head.appendChild(link);
  }
  document.documentElement.style.setProperty('--font-serif', font.family);
}
