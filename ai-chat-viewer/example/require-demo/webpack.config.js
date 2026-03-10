const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'require-demo.bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.js'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
      inject: 'body',
    }),
  ],
  devServer: {
    static: path.resolve(__dirname, 'dist'),
    port: 3080,
    hot: true,
  },
  devtool: 'source-map',
  performance: {
    hints: false,
  },
};
