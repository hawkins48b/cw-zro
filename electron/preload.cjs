// Sandboxed preload: it exposes nothing to the page.
//
// A sandboxed preload always runs as a classic script, whatever `"type"` says in
// package.json. Keep the .cjs extension and use `require`: `import` fails here, and
// `require` only loads `electron`. Node globals such as `Buffer` do not exist here.
