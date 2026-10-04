// Next's ESLint plugin uses only globSync(pattern, { onlyDirectories: true }).
// Preserve literal-directory matching and unmarked paths without an unsafe parser.
import { globSync as glob } from "tinyglobby";
export const globSync = (pattern, options = {}) =>
  glob(pattern, {
    ...options,
    expandDirectories: false,
  }).map((path) => path.replace(/\/$/, ""));
