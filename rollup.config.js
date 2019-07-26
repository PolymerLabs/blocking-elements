import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import {uglify} from 'rollup-plugin-uglify';

export default [{
  input: 'dist/blocking-elements.js',
  output: {
    file: 'dist/blocking-elements.min.js',
    format: 'iife',
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({
      exclude: 'node_modules/**',  // only transpile our source code
    }),
    uglify({
      output: {
        comments: function(node, comment) {
          const text = comment.value;
          // comment2 is a /* style comment.
          if (comment.type === 'comment2' && text.includes('@license')) {
            // We only want to include each license once. Note we put the Set on
            // "this" because we can't access module-scoped variables, since
            // isn't really a module.
            this.uniqueLicenses = this.uniqueLicenses || new Set();
            if (!this.uniqueLicenses.has(text)) {
              this.uniqueLicenses.add(text);
              return true;
            }
          }
          return false;
        }
      }
    }),
  ],
}];
