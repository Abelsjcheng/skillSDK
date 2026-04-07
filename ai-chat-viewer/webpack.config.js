const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {
  RESOLVE_EXTENSIONS,
  WEBPACK_ES5_TARGET,
  createEs5Output,
  createModuleRules,
} = require('./webpack.shared');

module.exports = (env = {}, argv = {}) => {
  const mode = argv.mode === 'production' ? 'production' : 'development';
  const isDevelopment = mode === 'development';
  const rawIsProEnv = env.isProEnv;
  const isProEnv = rawIsProEnv === undefined
    ? env.appEnv !== 'uat'
    : String(rawIsProEnv).toLowerCase() === 'true';

  return {
    mode,
    target: WEBPACK_ES5_TARGET,
    entry: './src/index.tsx',
    output: createEs5Output({
      path: path.resolve(__dirname, 'dist'),
      filename: isDevelopment ? 'js/[name].js' : 'js/bundle.[contenthash].js',
      chunkFilename: isDevelopment ? 'js/[name].chunk.js' : 'js/[name].[contenthash].js',
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
      minimize: !isDevelopment,
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
    devtool: isDevelopment ? 'eval-cheap-module-source-map' : false,
    performance: {
      hints: false,
    },
  };
};
