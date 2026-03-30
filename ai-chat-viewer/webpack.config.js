const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  createModuleRules,
} = require('./webpack.shared');

module.exports = (env = {}) => {
  const rawIsProEnv = env.isProEnv;
  const isProEnv = rawIsProEnv === undefined
    ? env.appEnv !== 'uat'
    : String(rawIsProEnv).toLowerCase() === 'true';

  return {
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
      new webpack.DefinePlugin({
        __IS_PRO_ENV__: JSON.stringify(isProEnv),
      }),
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
};
