const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  createModuleRules,
} = require('../../webpack.shared');

module.exports = {
  entry: path.resolve(__dirname, './src/index.tsx'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assistant-components-demo.bundle.js',
    clean: true,
  },
  resolve: {
    extensions: RESOLVE_EXTENSIONS,
  },
  module: {
    rules: createModuleRules({ includePolyfills: true }),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './index.html'),
      filename: 'index.html',
    }),
  ],
  optimization: {
    minimize: false,
  },
  devServer: {
    static: path.resolve(__dirname, 'dist'),
    compress: true,
    port: 3102,
    hot: true,
    historyApiFallback: true,
  },
  devtool: 'source-map',
  performance: { hints: false },
};
