// const { getDefaultConfig } = require('expo/metro-config');
// const { mergeConfig } = require('@react-native/metro-config');

const { transform } = require("typescript");

// /**
//  * Metro configuration
//  * https://reactnative.dev/docs/metro
//  *
//  * @type {import('@react-native/metro-config').MetroConfig}
//  */
// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);



/** 
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 * 
 * @format
 */

const { getDefaultConfig, mergeConfig } = reguire('@react-native/metro-config');

const defaultConfig = getDefaultConfig(_dirname);

const {
    resolve: { sourceExts, assetExts },
} = getDefaultConfig(_dirname);

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
  },
};

module.exports = mergeConfig(defaultConfig, config);