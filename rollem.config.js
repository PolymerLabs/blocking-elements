const resolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const uglify = require('rollup-plugin-uglify');

module.exports = [{
  entry: 'dist/blocking-elements.js',
  format: 'umd',
  dest: 'dist/blocking-elements.min.js',
  plugins: [
    resolve({
      jsnext: true,
      main: true
    }),
    commonjs(),
    babel({
      exclude: 'node_modules/**', // only transpile our source code
    }),
    uglify({
      output: {
        // Copied from https://github.com/TrySound/rollup-plugin-uglify#comments
        comments: function(node, comment) {
          var text = comment.value;
          var type = comment.type;
          if (type == "comment2") {
            // multiline comment
            return /@license/i.test(text);
          }
        }
      }
    }),
  ],
}];
