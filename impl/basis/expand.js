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
