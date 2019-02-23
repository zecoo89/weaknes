import { eslint } from "rollup-plugin-eslint"
import resolve from 'rollup-plugin-node-resolve'
import notify from 'rollup-plugin-notify'

export default {
  input: "./src/index.js",
  output: {
    name: "NesPack",
    file: "./dist/bundle.js",
    format: "umd",
    sourcemap: 'inline'
  },
  external: [ 'fs' ],
  plugins: [
    eslint(),
    resolve(),
    notify()
  ]
};
