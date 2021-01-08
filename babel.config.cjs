module.exports = (api) => {
  const BABEL_ENV = api.env();
  const targets = { node: BABEL_ENV === "cjs" ? 8 : 12 };
  const plugins = [
    [
      "@babel/plugin-transform-runtime",
      {
        corejs: 3,
      },
    ],
  ];
  return {
    presets: [
      [
        "@babel/preset-env",
        {
          targets,
          modules: BABEL_ENV === "mjs" ? false : "auto",
        },
      ],
    ],
    plugins,
  };
};
