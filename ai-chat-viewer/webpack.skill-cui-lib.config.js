const { createSharedLibWebpackConfig } = require('./webpack.shared.lib');

module.exports = (env = {}) => createSharedLibWebpackConfig({
  entry: './src/lib/skillCUI.ts',
  outputPath: 'dist/lib',
  filename: 'skill-cui.js',
  libraryName: 'AISkillCUI',
  singletonStyleTag: env.platform === 'pc' ? false : true,
}, env);
