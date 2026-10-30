// Tailwind preset: the design-system tokens as Tailwind theme values.
// Load ds.css (tokens) in the app, then in tailwind.config:
//   presets: [require("<path>/design-system/tailwind-preset.cjs")]
// Classes like bg-surface, text-ink-muted, border-line-strong and
// shadow-card then follow the brand and the light/dark theme.
const v = (name) => `var(--ds-${name})`;

module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: [v("font-sans")],
        display: [v("font-display")],
        mono: [v("font-mono")],
      },
      colors: {
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted"), faint: v("ink-faint") },
        page: v("page"),
        surface: { DEFAULT: v("surface"), sunken: v("surface-sunken"), hover: v("surface-hover") },
        line: { DEFAULT: v("line"), strong: v("line-strong"), hair: v("hairline") },
        chrome: { DEFAULT: v("chrome"), raised: v("chrome-raised"), text: v("chrome-text"), muted: v("chrome-muted") },
        accent: { DEFAULT: v("accent"), contrast: v("accent-contrast"), soft: v("accent-soft") },
        pop: { DEFAULT: v("pop"), contrast: v("pop-contrast") },
        info: v("info"),
        danger: v("danger"),
        success: v("success"),
      },
      borderRadius: { ds: v("radius-sm"), "ds-lg": v("radius-lg") },
      boxShadow: {
        card: `${v("offset-lg")} ${v("offset-lg")} 0 0 ${v("shadow")}`,
        btn: `${v("offset-sm")} ${v("offset-sm")} 0 0 ${v("shadow")}`,
        overlay: v("overlay-shadow"),
      },
      letterSpacing: { label: v("tracking-label"), button: v("tracking-button") },
      fontSize: { label: v("text-label") },
    },
  },
};
