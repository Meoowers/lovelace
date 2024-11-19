class LispSyntaxError extends Error {
  constructor(message, span) {
    let complement = "";

    if (span) {
      let newSpan = indexToLineColumn(__env.__current[1], span[0]);
      complement = ` at ${__env.__current[0]}:${newSpan.line}:${newSpan.column}`;
    }

    super(`${message}${complement}`);
    this.name = "LispSyntaxError";
    this.span = span;
  }
}

/** Checks if a character is whitespace */
const isWhitespace = (char) => /[\s\n\r\t]/.test(char);

/** Checks if a character can start an identifier */
const isIdentifierStart = (char) => /[^()"\s\r\n\t;]/.test(char);

/** Checks if a character is a digit */
const isDigit = (char) => /\d/.test(char);

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
            throw new LispSyntaxError("Invalid Unicode escape", [start, i]);
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

// Compilation

class LispCompilationError extends Error {
  constructor(message, span) {
    let complement = "";

    if (span) {
      let newSpan = indexToLineColumn(__env.__current[1], span[0]);
      complement = `${newSpan.line}:${newSpan.column}`;
    }

    super(`${message} at ${__env.__current[0]}:${complement}`);
    this.name = "LispCompilationError";
    this.span = span;
  }
}

const is = (node, typ) => {
  if (node.type != typ) {
    throw new LispCompilationError(
      `expected \`${typ}\` but got \`${node.type}\``,
      node.span
    );
  }
  return node;
};

const atLeast = (n) => (args, span) => {
  if (args.length < n) {
    throw new LispCompilationError(
      `expected at least \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const exactly = (n) => (args, span) => {
  if (args.length != n) {
    throw new LispCompilationError(
      `expected \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const between = (m, n) => (args, span) => {
  if (args.length < m || args.length > n) {
    throw new LispCompilationError(
      `expected from \`${m}\` to ${n} arguments but got \`${args.length}\``,
      span
    );
  }
};

const args = (node, fun) => {
  is(node, "list");
  fun(node.elements, node.span);
  let res = [...node.elements];
  return res;
};

// Specialize

/** This function specializes nodes in the format (let ((name expr)*) expr*) */
const specializeLet = (node) => {
  let result = {
    type: "let",
    params: [],
    body: [],
    span: node.span,
  };

  let body = args(node, atLeast(3));
  body.shift(); // Remove the first 'let'

  let elems = is(body.shift(), "list").elements;

  for (const elem of elems) {
    let newElems = args(elem, exactly(2));

    let name = is(newElems.shift(), "identifier");
    let value = specializeExpr(newElems.shift());

    result.params.push([name, value]);
  }

  result.body = body.map(specializeExpr);

  return result;
};

/** Specializes nodes in the format (block expr*) */
const specializeBlock = (node) => {
  let body = args(node, atLeast(2));
  body.shift(); // Remove the first 'block'

  return {
    type: "block",
    body: body.map(specializeExpr),
  };
};

/** Specializes nodes in the format (set* name expr) */
const specializeSetStar = (node) => {
  let elems = args(node, exactly(3));
  elems.shift(); // Remove the first 'set*'

  let name = is(elems.shift(), "identifier");
  let value = specializeExpr(elems.shift());

  return {
    type: "set*",
    name,
    value,
    span: node.span,
  };
};

/** Specializes nodes in the format (set name expr) */
const specializeSet = (node) => {
  let elems = args(node, exactly(3));
  elems.shift(); // Remove the first 'set'

  let name = is(elems.shift(), "identifier");
  let value = specializeExpr(elems.shift());

  return {
    type: "set",
    name,
    value,
    span: node.span,
  };
};

/** Specializes nodes in the format (fn (ident*) expr) */
const specializeFn = (node) => {
  let elems = args(node, between(3, 4));
  elems.shift(); // Remove the first 'fn'

  let fst = elems.shift();
  let params;
  let name;

  if (fst.type != "identifier") {
    args(node, exactly(3));
    params = is(fst, "list").elements.map((param) => is(param, "identifier"));
  } else {
    name = fst.value;
    params = is(elems.shift(), "list").elements.map((param) =>
      is(param, "identifier")
    );
  }

  let body = specializeExpr(elems.shift());

  return {
    type: "fn",
    params,
    name,
    body,
    span: node.span,
  };
};

/** Specializes nodes in the format (quote expr) */
const specializeQuote = (node) => {
  let elems = args(node, exactly(2));
  elems.shift(); // Remove the first 'quote'

  return {
    type: "quote",
    value: elems.shift(),
    span: node.span,
  };
};

/** Specializes nodes in the format (while cond expr) */
const specializeWhile = (node) => {
  let body = args(node, atLeast(2));
  body.shift(); // Remove the first 'block'
  let cond = specialize(body.shift());

  return {
    type: "while",
    cond,
    body: body.map(specializeExpr),
  };
};

/** Specializes nodes in the format (macro name) */
const specializeMacro = (node) => {
  let elems = args(node, exactly(2));
  elems.shift(); // Remove the first 'macro'

  let name = is(elems.shift(), "identifier");

  return {
    type: "macro",
    name,
    span: node.span,
  };
};

const specializeIf = (node) => {
  let elems = args(node, between(3, 4));
  elems.shift();

  let cond = specializeExpr(elems.shift());
  let thenBranch = specializeExpr(elems.shift());
  let elseBranch = elems.length == 0 ? mkNil() : specializeExpr(elems.shift());

  return {
    type: "if",
    cond,
    then: thenBranch,
    else: elseBranch,
    span: node.span,
  };
};

const mangle = (name) => {
  let mangled = /^[a-zA-Z_$]/.test(name[0])
    ? name[0]
    : "_" + name.charCodeAt(0).toString(16);

  for (let i = 1; i < name.length; i++) {
    const char = name[i];
    if (/^[a-zA-Z0-9_$]$/.test(char)) {
      mangled += char;
    } else {
      mangled += "_u" + char.charCodeAt(0).toString(16);
    }
  }

  return "$" + mangled;
};

const specializeExpr = (node) => {
  switch (node.type) {
    case "identifier":
    case "string":
    case "number":
    case "atom":
      return node;
    case "list": {
      if (node.elements.length == 0) {
        return node;
      }

      let nameExpr = args(node, atLeast(1));
      let name = is(nameExpr.shift(), "identifier");
      switch (name.value) {
        case "let":
          return specializeLet(node);
        case "block":
          return specializeBlock(node);
        case "set*":
          return specializeSetStar(node);
        case "set":
          return specializeSet(node);
        case "fn":
          return specializeFn(node);
        case "quote":
          return specializeQuote(node);
        case "while":
          return specializeWhile(node);
        case "if":
          return specializeIf(node);
        case "macro":
          return specializeMacro(node);
        default:
          return {
            type: "app",
            name,
            params: nameExpr.map(specializeExpr),
            span: node.span,
          };
      }
    }
  }
};

const specialize = (node) => {
  is(node, "list");
  return specializeExpr(node);
};

// Checker

const generate = (node, scope = new Map(), span, quote = false) => {
  const uniqueName = (scope, name, l = 0) => {
    let count = scope.get(name) - l || 0;
    scope.set(name, count + 1);
    return mangle(name) + (count > 0 ? count : "");
  };

  const getUnique = (name) => {
    let count = scope.get(name) - 1 || 0;
    return mangle(name) + (count > 0 ? count : "");
  };

  switch (node.type) {
    case "identifier":
      if (quote) return JSON.stringify(node);

      if (scope.has(node.value)) {
        return getUnique(node.value, 1); // Local reference
      } else {
        return `__env.__find("${node.value}", (${JSON.stringify(node.span)}))`; // Global reference
      }

    case "string":
    case "number":
    case "atom":
    case "list":
      return `(${JSON.stringify(node)})`;
    case "let":
      const letScope = new Map(scope); // Create new scope for let block

      const letBindings = node.params
        .map(([name, value]) => {
          const jsValue = generate(value, letScope, node.span || span);
          const uniqueVar = uniqueName(letScope, name.value);
          return `let ${uniqueVar} = ${jsValue};`;
        })
        .join(" ");

      const letBody = node.body.map((expr) =>
        generate(expr, letScope, node.span || span)
      );
      return `(() => { ${letBindings} ${letBody
        .map((x, i) => (i == letBody.length - 1 ? `return ${x}` : x))
        .join(";")}; })()`;

    case "set":
      if (scope.has(node.name.value)) {
        return `(() => { ${uniqueName(scope, node.name.value, 1)} = ${generate(
          node.value,
          scope,
          node.span || span
        )}; return mkNil() })()`; // Local reference
      } else {
        throw new LispCompilationError(
          `compilation error: cannot find variable \`${node.name.value}\``,
          node.name.span
        );
      }
    case "block":
      const blockBody = node.body
        .map((expr, index) => {
          if (index === node.body.length - 1) {
            return `return ${generate(expr, scope, node.span || span)};`;
          }
          return `${generate(expr, scope, node.span || span)};`;
        })
        .join(" ");

      return `(() => { ${blockBody} })()`;

    case "set*":
      const setValue = generate(node.value, scope, node.span || span);
      return `(() => { __env.__values["${node.name.value}"] = { "value": ${setValue} };
                             __env.__defined_by["${node.name.value}"] = __env.__current[0];
                             return mkNil();
                           })()`;

    case "fn":
      const fnScope = new Map(scope);

      const fnParams = node.params
        .map((param) => {
          const paramName = param.value.startsWith("&")
            ? param.value.slice(1)
            : param.value;

          fnScope.set(paramName, 0);

          return param.value.startsWith("&")
            ? `let ${uniqueName(
                fnScope,
                paramName
              )} = { type: "list", elements: [...__args] };`
            : `let ${uniqueName(fnScope, paramName)} = __args.shift();`;
        })
        .join(" ");

      const fnArgsCheck = node.params.some((param) =>
        param.value.startsWith("&")
      )
        ? `atLeastArgs(__args, ${node.params.length - 1}, ${JSON.stringify(
            node.span
          )}, ${node.name ? `"${node.name}"` : ""});`
        : `exactArgs(__args, ${node.params.length}, ${JSON.stringify(
            node.span
          )}, ${node.name ? `"${node.name}"` : ""});`;

      const fnBody = generate(node.body, fnScope, node.span || span);

      return `({ type: "closure"${
        node.name ? `, name: "${node.name}"` : ""
      }, file: ${JSON.stringify(
        __env.__current[0]
      )}, value: (__args) => { ${fnArgsCheck} ${fnParams} return ${fnBody}; }})`;

    case "if":
      const cond = generate(node.cond, scope, node.span || span);
      const thenBranch = generate(node.then, scope, node.span || span);
      const elseBranch = generate(node.else, scope, node.span || span);
      return `((toJSBool(${cond})) ? ${thenBranch} : ${elseBranch})`;

    case "quote":
      return JSON.stringify(node.value);

    case "macro":
      return `(() => {__env.__values["${node.name.value}"].macro = true; return mkNil()})()`;

    case "app":
      const appName = generate(node.name, scope, node.span || span);
      const appParams = node.params
        .map((param) => generate(param, scope, node.span || span))
        .join(", ");
      return `call(${appName},[${appParams}], ${JSON.stringify(
        node.span || span
      )})`;

    case "while": {
      const cond = generate(node.cond, scope, node.span || span);
      const body = node.body
        .map((expr) => generate(expr, scope, node.span || span))
        .join(";");
      return `(() => { while (toJSBool(${cond})) { ${body} }; return mkNil(); })()`;
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
};

// Runtime

// Expand

const expand = (node, first) => {
  switch (node.type) {
    case "identifier": {
      let res = __env.__values[node.value];
      if (res && res.macro && first) {
        __env.__expanded = true;
        return res.value;
      }
      return node;
    }
    case "string":
    case "atom":
    case "number":
      return node;
    case "list": {
      let elements = node.elements.map((x, idx) => expand(x, idx == 0));

      if (elements.length > 0 && elements[0].type == "closure") {
        let args = [...elements];
        args.shift();
        let res = call(elements[0], args, node.span);

        res.span = node.span;

        return res;
      } else {
        return {
          type: "list",
          elements,
          span: node.span,
        };
      }
    }
  }
};

// Error

// It will be expanded in the future.
const getSurroundingLines = (lines, start, _end) => {
  const { line: startLine } = start;
  const firstLine = Math.max(0, startLine);
  const surroundingLines = [];
  surroundingLines.push([firstLine, lines[firstLine - 1]]);
  return surroundingLines;
};

// Runtime

class LispRuntimeError extends Error {
  constructor(message, span, file) {
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

let toJSStr = (x) => {
  switch (x?.type) {
    case "list":
      return `(${x.elements.map(toJSStr).join(" ")})`;
    case "array":
      return `(array ${x.elements.map(toJSStr).join(" ")})`;
    case "number":
      return x.value.toString();
    case "string":
      return JSON.stringify(x.value);
    case "identifier":
      return x.value;
    case "atom":
      return ":" + x.value;
    case "closure":
      return "<closure>";
    case "dict":
      return `(dict ${Object.values(x.elements)
        .map((x) => `(${toJSStr(x.key)} ${toJSStr(x.value)})`)
        .join(" ")})`;
    default:
      return `{?}`;
  }
};

let getJSStr = (x) => {
  switch (x?.type) {
    case "number":
      return x.value.toString();
    case "string":
    case "identifier":
      return x.value;
    case "atom":
      return ":" + x.value;
    default:
      return toJSStr(x);
  }
};

const toJSBool = (arg) => {
  switch (arg.type) {
    case "number":
      return parseInt(arg.value) != 0;
    case "string":
      return arg.value.length != 0;
    case "identifier":
      return arg.value != "false";
    case "atom":
      return arg.value != "false";
    case "list":
    case "array":
      return arg.elements.length != 0;
  }
  return true;
};

/// true
const mkTrue = () => ({
  type: "identifier",
  value: "true",
});

/// false
const mkFalse = () => ({
  type: "identifier",
  value: "false",
});

/// true
const mkBool = (bool) => (bool ? mkTrue() : mkFalse());

/// 1
const mkNum = (value) => ({
  type: "number",
  value,
});

/// (1 2 3)
const mkList = (elements) => ({
  type: "list",
  elements,
});

const mkDict = (elements) => ({
  type: "dict",
  elements,
});

/// ()
const mkNil = () => ({
  type: "list",
  elements: [],
});

/// Strings
const mkString = (value) => ({
  type: "string",
  value,
});

/// Strings
const mkIdent = (value) => ({
  type: "identifier",
  value,
});

// Fast comparison string, its used like :name
const mkAtom = (value) => ({
  type: "atom",
  value,
});

const atLeastArgs = (args, n, span) => {
  if (args.length < n) {
    throw new LispRuntimeError(
      `expected at least \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const exactArgs = (args, n, span) => {
  if (args.length != n) {
    throw new LispRuntimeError(
      `expected \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const check = (arg, typ) => {
  if (typ instanceof Array) {
    if (!typ.includes(arg.type)) {
      throw new LispRuntimeError(
        `expected \`${typ.join(", ")}\` but got \`${arg.type}\``,
        arg.span
      );
    }
  } else {
    if (arg.type != typ) {
      throw new LispRuntimeError(
        `expected \`${typ}\` but got \`${arg.type}\``,
        arg.span
      );
    }
  }
  return arg;
};

const call = (arg, args, span) => {
  if (arg.type != "closure") {
    throw new LispRuntimeError(`cannot apply a \`${arg.type}\``, span);
  }

  __env.__frames.push([arg.name ? arg.name : "[anonymous]", arg.file, span]);

  let res = arg.value(args, span);

  //if (!arg.prim) {
  __env.__frames.pop();
  //}

  return res;
};

// Primitives

const compareNumbers = (comparisonFn, n) => (args, span) => {
  exactArgs(args, 2, span, n);
  let a = check(args.shift(), ["number", "string"]);
  let b = check(args.shift(), ["number", "string"]);
  return comparisonFn(a.value, b.value) ? mkTrue() : mkFalse();
};

const calculateNumbers = (comparisonFn, n) => (args, span) => {
  atLeastArgs(args, 1, span, n);

  let first = check(args.shift(), "number");

  let result = parseInt(first.value);

  for (const arg of args) {
    check(arg, "number");
    result = comparisonFn(result, arg.value);
  }

  return mkNum(result);
};

const fn_cons = (args, span) => {
  exactArgs(args, 2, span, "cons");
  let head = args.shift();
  let elem = args.shift();
  if (elem.type == "list") {
    return {
      type: "list",
      elements: [head, ...elem.elements],
      span: elem.span,
    };
  } else {
    return {
      type: "list",
      elements: [head, elem],
    };
  }
};

const fn_push = (args, span) => {
  exactArgs(args, 2, span, "cons");
  let elem = args.shift();
  let head = args.shift();
  if (elem.type == "list") {
    return {
      type: "list",
      elements: [...elem.elements, head],
      span: elem.span,
    };
  } else if (elem.type == "array") {
    elem.elements.push(head);
  } else {
    return {
      type: "array",
      elements: [elem, head],
    };
  }
};

const fn_check = (args, span) => {
  exactArgs(args, 2, span, "check");
  let elem = args.shift();
  let type = check(args.shift(), "string");
  check(elem, type.value);
  return mkNil();
};

const fn_list = (args) => {
  return {
    type: "list",
    elements: args,
  };
};

const fn_array = (args) => {
  return {
    type: "array",
    elements: args,
  };
};

const fn_print = (args) => {
  console.log(args.map(getJSStr).join(" "));
  return mkNil();
};

const fn_eprint = (args) => {
  console.error(args.map(getJSStr).join(" "));
  return mkNil();
};

const fn_exit = (args, span) => {
  exactArgs(args, 1, span, "exit");
  let a = check(args.shift(), ["number"]);
  console.log("at");
  process.exit(a.value);
};

const fn_unsafe_eval = (args, span) => {
  atLeastArgs(args, 1, span, "unsafe-eval");
  let a = check(args.shift(), ["string"]);

  let newArgs = args.map((x) => x.elements !== undefined || x.value);

  return eval(a.value)(...newArgs);
};

const fn_unsafe_from_js_obj = (args, span) => {
  exactArgs(args, 2, span, "unsafe-from-js-obj");

  let unknown = args.shift();
  let type = check(args.shift(), ["string"]);

  if (type.value == "list") {
    return { type: type.value, elements: unknown === undefined ? [] : unknown };
  } else {
    return { type: type.value, value: unknown };
  }
};

const fn_is_cons = (args, span) => {
  exactArgs(args, 1, span, "cons?");
  let elem = args.shift();
  return mkBool(elem.type == "list" && elem.elements.length > 0);
};

const fn_is_nil = (args, span) => {
  exactArgs(args, 1, span, "nil?");
  let elem = args.shift();
  return mkBool(elem.type == "list" && elem.elements.length == 0);
};

const fn_head = (args, span) => {
  exactArgs(args, 1, span, "head");
  let elem = args.shift();
  if (elem.type == "list" && elem.elements.length > 0) {
    return elem.elements[0];
  } else {
    return mkNil();
  }
};

const fn_string = (args, span) => {
  exactArgs(args, 1, span, "string");
  let elem = args.shift();
  return mkString(toJSStr(elem));
};

const fn_type = (args, span) => {
  exactArgs(args, 1, span, "type");
  let elem = args.shift();
  return mkString(elem.type);
};

const fn_tail = (args, span) => {
  exactArgs(args, 1, span, "tail");
  let elem = args.shift();
  if (elem.type == "list" && elem.elements.length > 0) {
    let elements = [...elem.elements];
    elements.shift();
    return {
      type: "list",
      elements,
      span: elem.span,
    };
  } else {
    return mkFalse();
  }
};
const areEqual = (a, b) => {
  if (a.type !== b.type) {
    return false;
  }

  switch (a.type) {
    case "list":
      if (a.elements.length !== b.elements.length) return false;
      return a.elements.every((el, idx) => areEqual(el, b.elements[idx]));
    case "number":
    case "string":
    case "identifier":
    case "atom":
      return a.value === b.value;
    case "closure":
      return false;
    default:
      return false;
  }
};

const fn_eq = (args, span) => {
  exactArgs(args, 2, span, "eq");
  return mkBool(areEqual(args[0], args[1]));
};

const fn_neq = (args, span) => {
  exactArgs(args, 2, span, "neq");
  return mkBool(!areEqual(args[0], args[1]));
};

const fn_concat = (args, span) => {
  atLeastArgs(args, 1, span, "concat");

  let type = "";

  let fst = check(args.shift(), ["string", "list", "identifier"]);
  type = fst.type;

  let result;

  if (fst.type == "list") {
    let res = args.map((arg) => {
      check(arg, type);
      return arg.elements;
    });

    result = fst.elements.concat(...res);
  } else {
    result =
      fst.value +
      args
        .map((arg) => {
          check(arg, type);
          return arg.value;
        })
        .join("");
  }

  if (fst.type == "string") {
    return mkString(result);
  } else if (fst.type == "list") {
    return mkList(result);
  } else {
    return mkIdent(result);
  }
};

const fn_indexOf = (args, span) => {
  exactArgs(args, 2, span, "indexOf");
  let str = check(args.shift(), "string");
  let substr = check(args.shift(), "string");
  return mkNum(str.value.indexOf(substr.value));
};

const fn_startsWith = (args, span) => {
  exactArgs(args, 2, span, "startsWith");
  let str = check(args.shift(), "string");
  let substr = check(args.shift(), "string");
  return mkBool(str.value.startsWith(substr.value));
};

const fn_substring = (args, span) => {
  exactArgs(args, 3, span, "substring");
  let str = check(args.shift(), "string");
  let start = check(args.shift(), "number");
  let length = check(args.shift(), "number");
  if (start.value < 0 || start.value >= str.value.length || length.value < 0) {
    return mkNil();
  }
  return mkString(str.value.substring(start.value, length.value));
};

const fn_at = (args, span) => {
  exactArgs(args, 2, span, "at");
  let str = check(args.shift(), ["string", "list"]);
  let index = check(args.shift(), "number");

  if (str.type == "list") {
    if (index.value < 0 || index.value >= str.elements.length) {
      return mkNil();
    }
    return str.elements[index.value];
  } else {
    if (index.value < 0 || index.value >= str.value.length) {
      return mkNil();
    }
    return mkString(str.value.charAt(index.value));
  }
};

const fn_length = (args, span) => {
  exactArgs(args, 1, span, "length");
  let str = check(args.shift(), ["string", "list"]);

  if (str.type == "string") {
    return mkNum(str.value.length);
  }

  return mkNum(str.elements.length);
};

const fn_not = (args, span) => {
  exactArgs(args, 1, span, "not");
  let value = toJSBool(args.shift());

  return mkBool(!value);
};

const fn_atom = (args, span) => {
  exactArgs(args, 1, span, "atom");

  return mkAtom(getJSStr(args.shift()));
};

const fn_identifier = (args, span) => {
  exactArgs(args, 1, span, "identifier");

  return mkIdent(getJSStr(args.shift()));
};

const fn_int = (args, span) => {
  exactArgs(args, 1, span, "int");

  return mkNum(parseInt(getJSStr(args.shift())));
};

const fn_dict = (args, span) => {
  if (args.length % 2 != 0) {
    throw new LispRuntimeError(
      `expected an even number of arguments but got \`${args.length}\``,
      span
    );
  }

  let result = {};

  let size = args.length / 2;
  for (let i = 0; i < size; i++) {
    let arg = args.shift();
    let name = check(arg, ["atom", "string", "identifier"], arg.span);
    let value = args.shift();
    result[name.value] = { key: name, value };
  }

  return mkDict(result);
};

const fn_dict_insert = (args, span) => {
  exactArgs(args, 3, span, "dict_insert");
  let dict = check(args.shift(), "dict");
  let key = check(args.shift(), ["atom", "string", "identifier"]);
  let value = args.shift();

  let refkey = key.value;

  if (!(key.value in dict.elements)) {
    dict.elements[refkey] = { key, value };
  } else {
    dict.elements[refkey].value = value;
  }

  return mkNil();
};

const fn_dict_get = (args, span) => {
  exactArgs(args, 2, span, "dict_get");
  let dict = check(args.shift(), "dict");
  let key = check(args.shift(), ["atom", "string", "identifier"]);

  let refkey = key.value;

  if (refkey in dict.elements) {
    return dict.elements[refkey].value;
  } else {
    return mkNil();
  }
};

const fn_dict_remove = (args, span) => {
  exactArgs(args, 2, span, "dict_remove");
  let dict = check(args.shift(), "dict");
  let key = check(args.shift(), ["atom", "string", "identifier"]);

  if (key.value in dict.value) {
    delete dict.value[refkey];
  }

  return mkNil();
};

const fn_require = (args, span) => {
  exactArgs(args, 1, span, "require");
  let str = check(args.shift(), "string");

  if (!__env.__files.has(str.value)) {
    let file = fs.readFileSync(str.value, { encoding: "UTF-8" });
    let cur = __env.__current;
    __env.__current = [str.value, file];
    __env.__files.set(str.value, file);
    run(file);
    __env.__current = cur;
  }

  return mkNil();
};

const fn_span = (args, span) => {
  exactArgs(args, 1, span, "span");

  let expr = args[0];

  if (expr.span) {
    return mkList([mkNum(expr.span[0]), mkNum(expr.span[1])]);
  } else {
    return mkNil();
  }
};

const fn_set_span = (args, span) => {
  exactArgs(args, 2, span, "set-span");

  let expr = args[0];
  let spanExpr = args[1];

  expr.span = translateToJS(spanExpr);

  return expr;
};

const fn_throw = (args, span) => {
  atLeast(args, 1, span, "throw");
  let str = check(args.shift(), "string");

  let pos = args.length > 0 && translateToJS(args.shift());
  let file = args.length > 0 && getJSStr(args.shift());

  throw new LispRuntimeError(str.value, pos, file);
};

const fn_apply = (args, span) => {
  atLeast(args, 2, span, "apply");
  let fn = check(args.shift(), "closure");
  let ls = check(args.shift(), "list");

  return call(fn, ls.elements, span);
};

const fn_eval = (args, span) => {
  atLeast(args, 1, span, "eval");

  let specialized = specialize(args.shift());
  let code = generate(specialized, new Map(), specialized.span);

  return eval(code);
};

const fn_expand = (args, span) => {
  atLeast(args, 1, span, "expand");

  let expanded = args.shift();

  do {
    __env.__expanded = false;
    expanded = expand(expanded);
  } while (__env.__expanded);

  return expanded;
};

const fn_dict_to_list = (args, span) => {
  exactArgs(args, 1, span, "dict/to-list");
  let dict = check(args.shift(), "dict");

  let result = [];

  for (const key in dict.elements) {
    let entry = dict.elements[key];
    result.push({
      type: "list",
      elements: [entry.key, entry.value],
    });
  }

  return {
    type: "list",
    elements: result,
  };
};

const fn_dict_of_list = (args, span) => {
  exactArgs(args, 1, span, "dict/of-list");
  let list = check(args.shift(), "list");

  let result = {
    type: "dict",
    elements: {},
  };

  for (let entry of list.elements) {
    if (check(entry, "list").elements.length !== 2) {
      throw new Error(
        `Invalid entry in list: ${entry}, expected a list of key-value pairs.`
      );
    }

    let key = entry.elements[0];
    let value = entry.elements[1];

    result.elements[key.value] = {
      key: key,
      value: value,
    };
  }

  return result;
};

const __env = {
  __expanded: false,
  __files: new Map(),
  __current: "",
  __defined_by: {},
  __values: {
    "cons?": { value: { type: "closure", prim: true, value: fn_is_cons } },
    "nil?": { value: { type: "closure", prim: true, value: fn_is_nil } },
    cons: { value: { type: "closure", prim: true, value: fn_cons } },
    push: { value: { type: "closure", prim: true, value: fn_push } },
    head: { value: { type: "closure", prim: true, value: fn_head } },
    string: { value: { type: "closure", prim: true, value: fn_string } },
    type: { value: { type: "closure", prim: true, value: fn_type } },
    tail: { value: { type: "closure", prim: true, value: fn_tail } },
    "+": {
      value: {
        type: "closure",
        prim: true,
        value: calculateNumbers((x, y) => x + y),
      },
    },
    "%": {
      value: {
        type: "closure",
        prim: true,
        value: calculateNumbers((x, y) => x % y),
      },
    },
    "-": {
      value: {
        type: "closure",
        prim: true,
        value: calculateNumbers((x, y) => x - y),
      },
    },
    "<": {
      value: {
        type: "closure",
        prim: true,
        value: compareNumbers((x, y) => x < y),
      },
    },
    ">": {
      value: {
        type: "closure",
        prim: true,
        value: compareNumbers((x, y) => x > y),
      },
    },
    ">=": {
      value: {
        type: "closure",
        prim: true,
        value: compareNumbers((x, y) => x >= y),
      },
    },
    "<=": {
      value: {
        type: "closure",
        prim: true,
        value: compareNumbers((x, y) => x <= y),
      },
    },

    list: { value: { type: "closure", prim: true, value: fn_list } },
    array: { value: { type: "closure", prim: true, value: fn_array } },
    print: { value: { type: "closure", prim: true, value: fn_print } },
    eprint: { value: { type: "closure", prim: true, value: fn_eprint } },
    exit: { value: { type: "closure", prim: true, value: fn_exit } },

    "=": { value: { type: "closure", prim: true, value: fn_eq } },
    "!=": { value: { type: "closure", prim: true, value: fn_neq } },

    "*": {
      value: {
        type: "closure",
        prim: true,
        value: calculateNumbers((x, y) => x * y),
      },
    },
    "/": {
      value: {
        type: "closure",
        prim: true,
        value: calculateNumbers((x, y) => Math.floor(x / y)),
      },
    },

    length: { value: { type: "closure", prim: true, value: fn_length } },
    atom: { value: { type: "closure", prim: true, value: fn_atom } },
    identifier: {
      value: { type: "closure", prim: true, value: fn_identifier },
    },
    int: { value: { type: "closure", prim: true, value: fn_int } },
    at: { value: { type: "closure", prim: true, value: fn_at } },
    not: { value: { type: "closure", prim: true, value: fn_not } },

    "string/substring": {
      value: { type: "closure", prim: true, value: fn_substring },
    },
    "string/indexOf": {
      value: { type: "closure", prim: true, value: fn_indexOf },
    },
    "string/starts": {
      value: { type: "closure", prim: true, value: fn_startsWith },
    },
    concat: { value: { type: "closure", prim: true, value: fn_concat } },

    apply: { value: { type: "closure", prim: true, value: fn_apply } },
    eval: { value: { type: "closure", prim: true, value: fn_eval } },
    expand: { value: { type: "closure", prim: true, value: fn_expand } },
    "%unsafe-eval": {
      value: { type: "closure", prim: true, value: fn_unsafe_eval },
    },
    "%unsafe-from-js-obj": {
      value: { type: "closure", prim: true, value: fn_unsafe_from_js_obj },
    },
    check: { value: { type: "closure", prim: true, value: fn_check } },
    span: { value: { type: "closure", prim: true, value: fn_span } },
    "set-span": { value: { type: "closure", prim: true, value: fn_set_span } },
    throw: { value: { type: "closure", prim: true, value: fn_throw } },
    require: { value: { type: "closure", prim: true, value: fn_require } },

    dict: { value: { type: "closure", prim: true, value: fn_dict } },
    "dict/set": {
      value: { type: "closure", prim: true, value: fn_dict_insert },
    },
    "dict/get": { value: { type: "closure", prim: true, value: fn_dict_get } },
    "dict/remove": {
      value: { type: "closure", prim: true, value: fn_dict_remove },
    },
    "dict/to-list": {
      value: { type: "closure", prim: true, value: fn_dict_to_list },
    },
    "dict/of-list": {
      value: { type: "closure", prim: true, value: fn_dict_of_list },
    },
  },
  __frames: [],
  __find: (name, span) => {
    if (!__env.__values[name]) {
      throw new LispRuntimeError(`cannot find variable \`${name}\``, span);
    }

    return __env.__values[name].value;
  },
};

// Test

const run = (input) => {
  let tokens = tokenize(input);
  let parts = parse(tokens);

  try {
    for (const listParsed of parts) {
      let span = listParsed.span;
      let expanded = listParsed;

      do {
        __env.__expanded = false;
        expanded = expand(expanded);
      } while (__env.__expanded);

      let specialized = specialize(expanded);

      let code = generate(specialized, new Map(), span || specialized.span);

      eval(code);
    }
  } catch (err) {
    if (
      err instanceof LispSyntaxError ||
      err instanceof LispCompilationError ||
      err instanceof LispRuntimeError
    ) {
      console.error("");
      console.error(err.message);

      if (__env.__frames.length > 0) {
        for (const frame of __env.__frames.reverse()) {
          let place = frame[1] || __env.__current[0];
          let input_new = __env.__files.get(frame[1]) || input;
          let start = indexToLineColumn(input_new, frame[2][0]);
          console.error(
            "   --> " +
              frame[0] +
              " in " +
              place +
              ":" +
              start.line +
              ":" +
              start.column
          );
        }
      }
      console.error("");
    } else {
      throw err;
    }
  }
};

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
