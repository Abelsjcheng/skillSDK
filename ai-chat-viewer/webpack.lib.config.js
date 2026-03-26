const path = require('path');
const {
  RESOLVE_EXTENSIONS,
  BASE_OPTIMIZATION,
  createModuleRules,
} = require('./webpack.shared');

module.exports = {
  mode: 'production',
  entry: './src/lib/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/lib'),
    filename: 'index.js',
    library: {
      name: 'AIChatViewer',
      type: 'umd',
    },
    globalObject: 'globalThis',
    clean: true,
    publicPath: './'
  },
  resolve: {
    extensions: RESOLVE_EXTENSIONS,
  },
  externals: {
    react: {
      commonjs: 'react',
      commonjs2: 'react',
      amd: 'react',
      root: 'React',
    },
    'react-dom/client': {
      commonjs: 'react-dom/client',
      commonjs2: 'react-dom/client',
      amd: 'react-dom/client',
      root: 'ReactDOM',
    },
    'react/jsx-runtime': {
      commonjs: 'react/jsx-runtime',
      commonjs2: 'react/jsx-runtime',
      amd: 'react/jsx-runtime',
      root: 'ReactJSXRuntime',
    },
  },
  module: {
    rules: createModuleRules({ singletonStyleTag: true }),
  },
  optimization: {
    minimize: false,
    usedExports: true,
  },
  devtool: "source-map",
  performance: { hints: false },
};
