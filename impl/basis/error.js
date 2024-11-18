const indexToLineColumn = (input, index) => {
  let line = 1,
    column = 1;

  for (let i = 0; i < index; i++) {
    if (input[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return {
    line,
    column,
  };
};

class LispRuntimeError extends Error {
  constructor(__env, message, span, file) {
    let complement = "";

    if (span) {
      let newSpan = indexToLineColumn(__env.__current[1], span[0]);
      complement = ` at ${file || __env.__current[0]}:${newSpan.line}:${
        newSpan.column
      }`;
    }

    super(`${message}${complement}`);
    this.name = "LispSyntaxError";
    this.span = span;
  }
}

module.exports = {
  indexToLineColumn,
  LispRuntimeError,
};
