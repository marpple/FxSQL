module.exports = () => ({
  visitor: {
    ImportDeclaration(path, state) {
      const { source } = path.node;
      const { value } = source;
      if (value.startsWith("fxjs/es")) {
        source.value = source.value.replace('fxjs/es', 'fxjs');
      }
    },
  },
});
