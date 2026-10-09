/**
 * Flags for the country picker, imported as assets so Vite rewrites their URLs
 * against the app's `base` (the build ships from a sub-path). Each SVG is under
 * the inline threshold, so it ends up as a data URI and needs no extra request.
 */
import gb from '../assets/flags/gb.svg';
import fr from '../assets/flags/fr.svg';
import de from '../assets/flags/de.svg';
import es from '../assets/flags/es.svg';
import pl from '../assets/flags/pl.svg';
import nl from '../assets/flags/nl.svg';
import other from '../assets/flags/other.svg';

export const COUNTRY_FLAG = {
  'United Kingdom': gb,
  France: fr,
  Germany: de,
  Spain: es,
  Poland: pl,
  Netherlands: nl,
  Other: other
};

export function flagFor(name) {
  return COUNTRY_FLAG[name] || other;
}
