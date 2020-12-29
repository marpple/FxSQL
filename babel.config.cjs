module.exports = (api) => {
  const BABEL_ENV = api.env();
  const targets = { node: BABEL_ENV === "cjs" ? 6 : 12 };
  return {
    presets: [
      [
        "@babel/preset-env",
        {
          targets,
          useBuiltIns: "usage",
          corejs: '3.8',
          modules: BABEL_ENV === "mjs" ? false : "auto",
        },
      ],
    ],
  };
};
