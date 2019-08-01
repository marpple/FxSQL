module.exports = function (api) {
  api.cache(false);
  const presets = [
    [
      "@babel/preset-env",
      {
        "targets": { node: 6 },
        "useBuiltIns": "usage",
        "corejs": 3
      }
    ]
  ];
  return { presets };
};