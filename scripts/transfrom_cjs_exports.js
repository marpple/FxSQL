import fs from "fs";

const writeFile = (path, data, encoding = "utf-8") =>
  new Promise((resolve, reject) => {
    fs.writeFile(path, data, encoding, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });

(async function() {
  await writeFile('./cjs/package.json', '{ "type": "commonjs" }');
  await writeFile('./index.js', 'module.exports = require("./cjs/index.js");');
  await writeFile('./ljoin.js', 'module.exports = require("./cjs/ljoin.js").default;');
})();