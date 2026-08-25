# Basic documentation example

This is the standalone Blits application embedded by `docs/basic-examples.md`. It intentionally does not use the repository's test and benchmark application.

From the package root, install and build it with:

```sh
npm run docs:examples:install
npm run docs:examples:build
```

The build is written to `docs/examples/basic/dist/` so the static Docsify site can load it directly in an iframe.
