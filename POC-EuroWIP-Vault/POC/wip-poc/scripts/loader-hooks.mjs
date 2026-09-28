/**
 * Resolve hook so Node can import db.js.
 *
 * db.js imports the wasm binary through Vite's `?url` suffix, which only exists
 * inside the Vite pipeline. Mapping it to a module that exports the file path
 * lets the same source run under Node, so the domain layer can be tested
 * without a browser.
 */
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.wasm?url')) {
    return {
      url: new URL('./wasm-url-shim.mjs', import.meta.url).href,
      shortCircuit: true
    };
  }
  return next(specifier, context);
}
