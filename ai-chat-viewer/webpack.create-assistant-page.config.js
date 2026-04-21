const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  WEBPACK_ES5_TARGET,
  createEs5Output,
  createModuleRules,
} = require('./webpack.shared');

module.exports = {
  target: WEBPACK_ES5_TARGET,
  entry: './src/pages/createAssistant.tsx',
  output: createEs5Output({
    path: path.resolve(__dirname, 'dist/create-assistant-page'),
    filename: 'js/create-assistant-page.[contenthash].js',
    assetModuleFilename: 'asset/[name].[contenthash][ext][query]',
    clean: true,
  }),
  resolve: {
    extensions: RESOLVE_EXTENSIONS,
  },
  module: {
    rules: createModuleRules({ includePolyfills: true }),
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/create-assistant-page.html',
      filename: 'index.html',
    }),
  ],
  optimization: {
    minimize: true,
    usedExports: true,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  devServer: {
    static: path.resolve(__dirname, 'dist/create-assistant-page'),
    compress: true,
    port: 3102,
    hot: true,
    historyApiFallback: true,
  },
  devtool: false,
  performance: {
    hints: false,
  },
};

