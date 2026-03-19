const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  createModuleRules,
} = require('./webpack.shared');

module.exports = {
  entry: './src/pages/personal-agent/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist/personal-agent-page'),
    filename: 'js/personal-agent-page.[contenthash].js',
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
      template: './public/personal-agent-page.html',
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
    static: path.resolve(__dirname, 'dist/personal-agent-page'),
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
