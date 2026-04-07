const BASE_BROWSERS_TARGET = {
  chrome: '49',
  edge: '15',
  firefox: '45',
  safari: '10',
  ios: '10',
};

const WEBPACK_ES5_TARGET = ['web', 'es5'];

const WEBPACK_ES5_OUTPUT_ENVIRONMENT = {
  arrowFunction: false,
  bigIntLiteral: false,
  const: false,
  destructuring: false,
  dynamicImport: false,
  forOf: false,
  module: false,
  optionalChaining: false,
  templateLiteral: false,
};

const TRANSPILE_DEPENDENCIES = [
  'hast-util-from-html-isomorphic',
  'react-markdown',
  'react-syntax-highlighter',
  'remark-breaks',
  'remark-gfm',
  'remark-math',
  'rehype-katex',
];

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function shouldTranspileDependency(filePath) {
  const packageMatches = [...filePath.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)];

  if (packageMatches.length === 0) {
    return true;
  }

  const packageName = packageMatches[packageMatches.length - 1][1];
  return TRANSPILE_DEPENDENCIES.includes(packageName);
}

function createEs5Output(output) {
  return {
    ...output,
    environment: {
      ...WEBPACK_ES5_OUTPUT_ENVIRONMENT,
      ...(output.environment || {}),
    },
  };
}

function createBabelRule({ includePolyfills = false } = {}) {
  const presetEnvOptions = {
    bugfixes: true,
    forceAllTransforms: true,
    targets: BASE_BROWSERS_TARGET,
  };
  if (includePolyfills) {
    presetEnvOptions.useBuiltIns = 'usage';
    presetEnvOptions.corejs = '3.44';
  }

  return {
    test: /\.(ts|tsx|js|jsx)$/,
    exclude: (filePath) => !shouldTranspileDependency(filePath),
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', presetEnvOptions],
          ['@babel/preset-react', { runtime: 'automatic' }],
          '@babel/preset-typescript',
        ],
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
  WEBPACK_ES5_TARGET,
  createEs5Output,
  createModuleRules,
};
