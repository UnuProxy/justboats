module.exports = {
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'development') {
        webpackConfig.resolve.modules = [
          'node_modules',
          paths.appNodeModules,
          paths.appSrc,
        ];
      }
      return webpackConfig;
    },
  },
};