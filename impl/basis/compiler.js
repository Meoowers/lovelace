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
        throw new LispRuntimeError(
          __env,
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

module.exports = { generate };
