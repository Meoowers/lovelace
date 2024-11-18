let { is, atLeast, between, args, exactly } = require("./check.js");

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
  let elseBranch =
    elems.length == 0
      ? {
          type: "list",
          elements: [],
        }
      : specializeExpr(elems.shift());

  return {
    type: "if",
    cond,
    then: thenBranch,
    else: elseBranch,
    span: node.span,
  };
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

module.exports = { specialize };
