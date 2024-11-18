const { parse, tokenize } = require("./parser.js");
const { LispRuntimeError } = require("./error.js");
const { specialize } = require("./specialize.js");
const { is, atLeast, between, args, exactly } = require("./check.js");
const { generate } = require("./compiler.js");
const fs = require("fs");

// Runtime

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

// Runtime

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
      __env,
      `expected at least \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const exactArgs = (args, n, span) => {
  if (args.length != n) {
    throw new LispRuntimeError(
      __env,
      `expected \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const check = (arg, typ) => {
  if (typ instanceof Array) {
    if (!typ.includes(arg.type)) {
      throw new LispRuntimeError(
        __env,
        `expected \`${typ.join(", ")}\` but got \`${arg.type}\``,
        arg.span
      );
    }
  } else {
    if (arg.type != typ) {
      throw new LispRuntimeError(
        __env,
        `expected \`${typ}\` but got \`${arg.type}\``,
        arg.span
      );
    }
  }
  return arg;
};

const call = (arg, args, span) => {
  if (arg.type != "closure") {
    throw new LispRuntimeError(__env, `cannot apply a \`${arg.type}\``, span);
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
      __env,
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

  throw new LispRuntimeError(__env, str.value, pos, file);
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
  let code = generate(__env, specialized, new Map(), specialized.span);

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
      throw new LispRuntimeError(
        __env,
        `cannot find variable \`${name}\``,
        span
      );
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

      let code = generate(
        __env,
        specialized,
        new Map(),
        span || specialized.span
      );

      eval(code);
    }
  } catch (err) {
    if (err instanceof LispRuntimeError) {
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

module.exports = { run, __env };
