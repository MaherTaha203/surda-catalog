/**
 * Remove external Google Fonts @imports from every CSS file (including the
 * bundled @blinkdotnew/ui theme sheets). The app self-hosts its only font
 * (Tajawal, src/fonts.css); the theme sheets each @import a different Google
 * Font that the app's `--font-sans: Tajawal` override makes unused. Stripping
 * them here — where PostCSS sees each file, unlike a Vite module transform —
 * keeps dev and prod identical, avoids an external request on every visit, and
 * keeps the offline-first PWA independent of fonts.googleapis.com.
 */
const stripExternalGoogleFonts = () => ({
  postcssPlugin: 'strip-external-google-fonts',
  AtRule: {
    import(rule) {
      if (/fonts\.googleapis\.com/.test(rule.params)) rule.remove();
    },
  },
});
stripExternalGoogleFonts.postcss = true;

module.exports = {
  plugins: [
    stripExternalGoogleFonts(),
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};
