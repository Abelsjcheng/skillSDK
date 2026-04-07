const BASE_BROWSERS_TARGET = {
  ie: '11',
};

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const TRANSPILE_NODE_MODULES = [
  /node_modules[\\/]react-markdown[\\/]/,
  /node_modules[\\/]remark-[^\\/]+[\\/]/,
  /node_modules[\\/]rehype-[^\\/]+[\\/]/,
  /node_modules[\\/]unified[\\/]/,
  /node_modules[\\/]bail[\\/]/,
  /node_modules[\\/]trough[\\/]/,
  /node_modules[\\/]vfile[^\\/]*[\\/]/,
  /node_modules[\\/]unist-[^\\/]+[\\/]/,
  /node_modules[\\/]mdast-[^\\/]+[\\/]/,
  /node_modules[\\/]hast-[^\\/]+[\\/]/,
  /node_modules[\\/]micromark[^\\/]*[\\/]/,
  /node_modules[\\/]decode-named-character-reference[\\/]/,
  /node_modules[\\/]character-entities[^\\/]*[\\/]/,
  /node_modules[\\/]property-information[\\/]/,
  /node_modules[\\/]space-separated-tokens[\\/]/,
  /node_modules[\\/]comma-separated-tokens[\\/]/,
];

function shouldExcludeFromBabel(filePath) {
  if (!/node_modules/.test(filePath)) {
    return false;
  }

  return !TRANSPILE_NODE_MODULES.some((pattern) => pattern.test(filePath));
}

function createBabelRule({ includePolyfills = false } = {}) {
  const presetEnvOptions = { targets: BASE_BROWSERS_TARGET };
  if (includePolyfills) {
    presetEnvOptions.useBuiltIns = 'usage';
    presetEnvOptions.corejs = '3.36';
  }

  return {
    test: /\.(ts|tsx|js|jsx)$/,
    exclude: shouldExcludeFromBabel,
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
  createModuleRules,
};
