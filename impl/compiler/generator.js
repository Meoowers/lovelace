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

const generate = (node, span, scope = new Map(), allowStmt = false) => {
  const uniqueName = (scope, name, l = 0) => {
    let count = scope.get(name) - l || 0;
    scope.set(name, count + 1);
    return mangle(name) + (count > 0 ? count : "");
  };

  const getUnique = (name) => {
    let count = scope.get(name) - 1 || 0;
    return mangle(name) + (count > 0 ? count : "");
  };

  const envFind = (node) =>
    `__env.__find("${node.value}", ${JSON.stringify(node.span)})`;

  switch (node.type) {
    case "string":
      return JSON.stringify(node.value);
    case "number":
      return JSON.stringify(node.value);
    case "atom":
      return `new Atom(${JSON.stringify(node.value)})`;
    case "identifier":
      return `new Identifier(${JSON.stringify(node.value)})`;
    case "list":
      return `[${node.elements.map((elem) =>
        generate(elem, elem.span, scope, false)
      )}]`;
    case "identifier":
      return scope.has(node.value) ? getUnique(node.value, 1) : envFind(node);
    case "let": {
      const letScope = new Map(scope);

      const letBindings = node.params
        .map(([name, value]) => {
          const jsValue = generate(value, node.span || span, letScope, false);
          const uniqueVar = uniqueName(letScope, name.value);
          return `let ${uniqueVar} = ${jsValue};`;
        })
        .join("\n");

      let letBody = node.body.map((expr) =>
        generate(expr, node.span || span, letScope, allowStmt)
      );

      if (allowStmt) {
        return `${letBindings}\n${letBody}`;
      }

      return `(() => {${letBindings}\n${letBody
        .map((x, i) => (i == letBody.length - 1 ? `return ${x}` : x))
        .join(";")}; })()`;
    }
    case "set": {
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
    }
  }
};
