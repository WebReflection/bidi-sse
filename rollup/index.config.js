import {nodeResolve} from '@rollup/plugin-node-resolve';

export default {
  input: './esm/client.js',
  plugins: [
    nodeResolve()
  ],
  
  output: {
    esModule: false,
    file: './test/bidi-sse.js',
    format: 'esm'
  }
};
