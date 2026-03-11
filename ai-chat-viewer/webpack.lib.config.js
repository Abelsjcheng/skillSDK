const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/lib/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/lib'),
    filename: 'index.js',
    library: {
      name: 'AIChatViewer',
      type: 'umd',
      export: 'default',
    },
    globalObject: 'this',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: '>0.5%, last 2 versions, not dead' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
              '@babel/preset-typescript',
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader', options: { insert: 'head', injectType: 'singletonStyleTag' } },
          'css-loader',
        ],
      },
      {
        test: /\.less$/,
        use: [
          { loader: 'style-loader', options: { insert: 'head', injectType: 'singletonStyleTag' } },
          'css-loader',
          'less-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico|woff|woff2|ttf|eot)$/i,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8192 } },
      },
    ],
  },
  optimization: {
    minimize: true,
    usedExports: true,
  },
  devtool: false,
  performance: { hints: false },
};
