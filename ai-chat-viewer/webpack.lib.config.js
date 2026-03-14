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
      export: 'default',
    },
    globalObject: 'this',
    clean: true,
    publicPath: './'
  },
  resolve: {
    extensions: RESOLVE_EXTENSIONS,
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
