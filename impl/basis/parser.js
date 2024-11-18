let { LispRuntimeError } = require("./error.js");

/** Checks if a character is whitespace */
const isWhitespace = (char) => /[\s\n\r\t]/.test(char);

/** Checks if a character can start an identifier */
const isIdentifierStart = (char) => /[^()"\s\r\n\t;]/.test(char);

/** Checks if a character is a digit */
const isDigit = (char) => /\d/.test(char);

/** Reads characters while predicate is true, starting from index */
const readWhile = (input, predicate, start) => {
  let str = "";
  let end = start;

  while (end < input.length && predicate(input[end])) {
    str += input[end++];
  }

  return {
    str,
    end,
  };
};

/** Reads a string literal starting from a given index, supporting escape sequences and Unicode */
const readString = (input, start) => {
  let str = "";
  let i = start + 1; // Start after the opening quote
  let escaped = false; // Tracks if the previous character was a backslash

  while (i < input.length) {
    let char = input[i];

    if (escaped) {
      // Handle escape sequences
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
          // Handle Unicode escape sequences: \uXXXX
          let unicode = input.slice(i + 1, i + 5);
          if (/^[0-9a-fA-F]{4}$/.test(unicode)) {
            str += String.fromCharCode(parseInt(unicode, 16));
            i += 4; // Move past the Unicode sequence
          } else {
            throw new LispRuntimeError("Invalid Unicode escape", [start, i]);
          }
          break;
        }
        default:
          str += char;
          break;
      }
      escaped = false;
    } else if (char === "\\") {
      escaped = true; // Next character will be part of an escape sequence
    } else if (char === '"') {
      // Closing quote found, return the string
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

  // If we reach here, the string was never closed
  throw new LispSyntaxError("Unclosed string", [start, i]);
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

const translateToJS = (data) => {
  switch (data.type) {
    case "identifier":
      return data.value;
    case "number":
      return data.value;
    case "list":
      return data.elements.map(translateToJS);
    case "dict":
      const result = {};
      for (const [key, value] of Object.entries(data.elements)) {
        result[translateToJS(key)] = translateToJS(value);
      }
      return result;
    case "string":
      return data.value;
    case "atom":
      return data.value;
    default:
      throw new Error(`Unknown type: ${data.type}`);
  }
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
    throw new LispSyntaxError("Unexpected character", [i, i + 1]);
  }

  return tokens;
};

const parseToken = (tokens, pos) => {
  if (pos >= tokens.length) {
    throw new LispSyntaxError("Unexpected end of input", [pos, pos + 1]);
  }
  return {
    node: tokens[pos],
    pos: pos + 1,
  };
};

const parseList = (tokens, start, pos) => {
  let elements = [];
  pos += 1;

  while (pos < tokens.length) {
    if (tokens[pos].type === "rparen") {
      return {
        node: {
          type: "list",
          elements,
          span: [start, tokens[pos].span[1]],
        },
        pos: pos + 1,
      };
    }
    const { node, pos: newPos } = parseExpression(tokens, pos);
    elements.push(node);
    pos = newPos;
  }

  throw new LispSyntaxError("Unclosed list", [start, tokens[pos - 1].span[1]]);
};

const parseExpression = (tokens, pos) => {
  let token = tokens[pos];

  if (token.type === "lparen") {
    return parseList(tokens, token.span[0], pos);
  }

  // handle simple types
  if (["identifier", "number", "string", "atom"].includes(token.type)) {
    return parseToken(tokens, pos);
  }

  // handle simple types
  if (
    ["quote", "unquote", "quasi-quote", "unsplice-quote"].includes(token.type)
  ) {
    let { node, pos: newPos } = parseExpression(tokens, pos + 1);
    return {
      node: {
        type: "list",
        elements: [
          { type: "identifier", value: token.type, span: token.span },
          node,
        ],
        span: [pos, tokens[newPos].span[1]],
      },
      pos: newPos,
    };
  }

  throw new LispSyntaxError(`unexpected token '${token.type}'`, token.span);
};

/** Parses a list of tokens into an abstract syntax tree (AST) */
const parse = (tokens) => {
  let ast = [];
  let pos = 0;

  while (pos < tokens.length) {
    const { node, pos: newPos } = parseExpression(tokens, pos);
    ast.push(node);
    pos = newPos;
  }

  return ast;
};

module.exports = { parse, tokenize };
