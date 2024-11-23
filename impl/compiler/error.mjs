/** Index to line and column. */
const indexToLineColumn = (input, index) => {
  let line = 1, column = 1;

  for (let i = 0; i < index; i++) {
    input[i] === "\n" ? (line++, column = 1) : column++;
  }

  return { line, column };
};

class LispError extends Error {
    constructor(message, span, file) {
      super(`lisperror: ${message}`);
  
      this.name = "LispCompilationError";
      this.span = span;
      this.file = file;
    }
}

export { LispError }