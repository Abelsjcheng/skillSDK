const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  BASE_OPTIMIZATION,
  createModuleRules,
} = require('./webpack.shared');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/bundle.[contenthash].js',
    assetModuleFilename: 'asset/[name].[contenthash][ext][query]',
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
      template: './public/index.html',
      filename: 'index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: '**/*.js',
          context: path.resolve(__dirname, 'public'),
          to: 'js/[path][name][ext]',
          noErrorOnMissing: true,
        },
        {
          from: '.wecode/plugin.json',
          to: 'plugin.json',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  optimization: {
    ...BASE_OPTIMIZATION,
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
    static: path.join(__dirname, 'public'),
    compress: true,
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
  devtool: false,
  performance: {
    hints: false,
  },
};
