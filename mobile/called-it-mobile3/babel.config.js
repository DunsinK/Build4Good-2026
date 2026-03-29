module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Add 'react-native-worklets-core/plugin' if you use VisionCamera frame processors.
  };
};
