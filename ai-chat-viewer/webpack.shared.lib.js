const path = require('path');
const { RESOLVE_EXTENSIONS, WEBPACK_ES5_TARGET, createEs5Output, createModuleRules } = require('./webpack.shared');

const createSharedLibWebpackConfig = ({ entry, outputPath, filename, libraryName, singletonStyleTag = true, needExternals = true }, env = {}) => ({
  mode: 'production',
  target: WEBPACK_ES5_TARGET,
  entry,
  output: createEs5Output({
    path: path.resolve(__dirname, outputPath),
    filename,
    library: {
      name: libraryName,
      type: 'umd',
    },
    globalObject: 'this',
    clean: false,
    publicPath: './',
  }),
  resolve: {
    extensions: RESOLVE_EXTENSIONS,
  },
  externals: needExternals ? {
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
  } : {},
  module: {
    rules: createModuleRules({ singletonStyleTag, platform: env.platform, product: 'skillCUI' }),
  },
  optimization: {
    minimize: false,
    usedExports: true,
  },
  devtool: 'source-map',
  performance: {
    hints: false,
  },
});

module.exports = {
  createSharedLibWebpackConfig,
};
