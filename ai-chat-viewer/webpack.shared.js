const BASE_BROWSERS_TARGET = '>0.5%, last 2 versions, not dead';

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const BASE_OPTIMIZATION = {
  minimize: true,
  usedExports: true,
};

function createBabelRule({ includePolyfills = false } = {}) {
  const presetEnvOptions = { targets: BASE_BROWSERS_TARGET };
  if (includePolyfills) {
    presetEnvOptions.useBuiltIns = 'usage';
    presetEnvOptions.corejs = '3.36';
  }

  return {
    test: /\.(ts|tsx|js|jsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', presetEnvOptions],
          ['@babel/preset-react', { runtime: 'automatic' }],
          '@babel/preset-typescript',
        ],
        plugins: ['@babel/plugin-proposal-optional-chaining'],
      },
    },
  };
}

function createStyleLoader(singletonStyleTag) {
  if (!singletonStyleTag) {
    return 'style-loader';
  }
  return {
    loader: 'style-loader',
    options: { insert: 'head', injectType: 'singletonStyleTag' },
  };
}

function createStyleRules({ singletonStyleTag = false } = {}) {
  const styleLoader = createStyleLoader(singletonStyleTag);
  return [
    {
      test: /\.css$/,
      use: [styleLoader, 'css-loader'],
    },
    {
      test: /\.less$/,
      use: [styleLoader, 'css-loader', 'less-loader'],
    },
  ];
}

function createAssetRule() {
  return {
    test: /\.(png|jpe?g|gif|svg|ico|woff|woff2|ttf|eot)$/i,
    type: 'asset',
    parser: {
      dataUrlCondition: {
        maxSize: 8192,
      },
    },
  };
}

function createModuleRules({ includePolyfills = false, singletonStyleTag = false } = {}) {
  return [
    createBabelRule({ includePolyfills }),
    ...createStyleRules({ singletonStyleTag }),
    createAssetRule(),
  ];
}

module.exports = {
  RESOLVE_EXTENSIONS,
  BASE_OPTIMIZATION,
  createModuleRules,
};

