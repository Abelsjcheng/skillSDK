const { createSharedLibWebpackConfig } = require('./webpack.shared.lib');

module.exports = createSharedLibWebpackConfig({
  entry: './src/lib/skillCUI.ts',
  outputPath: 'dist/lib',
  filename: 'skill-cui.js',
  libraryName: 'AISkillCUI',
});
