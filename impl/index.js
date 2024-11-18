const { run, __env } = require("./basis/runtime.js");
const fs = require("fs");

const cmdArgs = process.argv.slice(2);

if (cmdArgs.length < 1) {
  console.error("usage: lovelace <path>");
  process.exit(1);
}

const fileName = cmdArgs[0];

fs.readFile(fileName, "utf8", (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  __env.__current = [fileName, data];
  run(data);
});
