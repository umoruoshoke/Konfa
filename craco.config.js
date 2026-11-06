// craco.config.js
const { getLoader, loaderByName } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find the source-map-loader rule and exclude html5-qrcode
      const { isFound, match } = getLoader(
        webpackConfig,
        loaderByName('source-map-loader')
      );

      if (isFound) {
        match.loader.exclude = [
          /node_modules\/html5-qrcode/,
        ];
      }

      return webpackConfig;
    },
  },
};