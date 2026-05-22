const { createSharedLibWebpackConfig } = require('./webpack.shared.lib');

module.exports = createSharedLibWebpackConfig({
  entry: './src/lib/index.ts',
  outputPath: 'dist/lib',
  filename: 'index.js',
  libraryName: 'AIChatViewer',
});
