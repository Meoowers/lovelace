import { LispError } from './error.mjs'

/** Checks if a character is whitespace */
const isWhitespace = (char) => /[\s\n\r\t]/.test(char);

/** Checks if a character can start an identifier */
const isIdentifierStart = (char) => /[^()"\s\r\n\t;]/.test(char);

/** Checks if a character is a digit */
const isDigit = (char) => /\d/.test(char);

const readWhile = (input, predicate, start) => {
  let end = start;
  while (end < input.length && predicate(input[end])) end++;
  return { str: input.slice(start, end), end };
};

/** Reads a string literal starting from a given index, supporting escape sequences and Unicode */
const readString = (input, start) => {
  let str = "";
  let i = start + 1;
  let escaped = false;

  while (i < input.length) {
    let char = input[i];

    if (escaped) {
      switch (char) {
        case "n":
          str += "\n";
          break;
        case "t":
          str += "\t";
          break;
        case "r":
          str += "\r";
          break;
        case "\\":
          str += "\\";
          break;
        case '"':
          str += '"';
          break;
        case "u": {
          let unicode = input.slice(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(unicode)) {
            str += String.fromCharCode(parseInt(unicode, 16));
            i += 4;
          } else {
            throw new LispError("Invalid Unicode escape", [start, i]);
          }
          break;
        }
        default:
          str += char;
          break;
      }
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return {
        type: "string",
        value: str,
        span: [start, i + 1],
      };
    } else {
      str += char;
    }

    i++;
  }

  throw new LispError("Unclosed string", [start, i]);
};

/** Reads a number starting from a given index */
const readNumber = (input, start) => {
  const { str, end } = readWhile(input, isDigit, start);
  return {
    type: "number",
    value: Number(str),
    span: [start, end],
  };
};

/** Reads an identifier starting from a given index */
const readIdentifier = (input, start) => {
  const { str, end } = readWhile(input, isIdentifierStart, start);
  return {
    type: "identifier",
    value: str,
    span: [start, end],
  };
};

/** Reads an atom starting from a given index */
const readAtom = (input, start) => {
  const { str, end } = readWhile(input, isIdentifierStart, start + 1);

  return {
    type: "atom",
    value: str,
    span: [start, end],
  };
};

/** Returns a token with a given type */
const token = (type) => (input, start) => ({
  type,
  value: input[start],
  span: [start, start + 1],
});

/** Tokenizes the input string */
const tokenize = (input) => {
  let tokens = [];
  let i = 0;

  const checkRun = (check, run) => {
    let char = input[i];
    if (check(char)) {
      let token = run(input, i);
      i = token.span[1];
      tokens.push(token);
      return true;
    }
    return false;
  };

  while (i < input.length) {
    if (isWhitespace(input[i])) {
      i++;
      continue;
    }

    if (input[i] == ";") {
      let { end } = readWhile(input, (x) => x != "\n", i);
      i = end;
      continue;
    }

    if (checkRun((char) => char === "`", token("quasi-quote"))) continue;
    if (checkRun((char) => char === ",", token("unquote"))) continue;
    if (checkRun((char) => char === "@", token("unsplice-quote"))) continue;
    if (checkRun((char) => char === "'", token("quote"))) continue;

    if (checkRun(isDigit, readNumber)) continue;
    if (checkRun((x) => x == ":", readAtom)) continue;
    if (checkRun(isIdentifierStart, readIdentifier)) continue;
    if (checkRun((char) => char === '"', readString)) continue;
    if (checkRun((char) => char === "(", token("lparen"))) continue;
    if (checkRun((char) => char === ")", token("rparen"))) continue;

    throw new LispError("Unexpected character", [i, i + 1]);
  }

  return tokens;
};

export { tokenize }