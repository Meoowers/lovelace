const is = (node, typ) => {
  if (node.type != typ) {
    throw new LispRuntimeError(
      __env,
      `expected \`${typ}\` but got \`${node.type}\``,
      node.span
    );
  }
  return node;
};

const atLeast = (n) => (args, span) => {
  if (args.length < n) {
    throw new LispRuntimeError(
      __env,
      `expected at least \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const exactly = (n) => (args, span) => {
  if (args.length != n) {
    throw new LispRuntimeError(
      __env,
      `expected \`${n}\` arguments but got \`${args.length}\``,
      span
    );
  }
};

const between = (m, n) => (args, span) => {
  if (args.length < m || args.length > n) {
    throw new LispRuntimeError(
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

module.exports = { is, atLeast, between, args, exactly };
