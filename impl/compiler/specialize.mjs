import {
    LispError
} from "./error.mjs";

const updateStateLocals = (state, key) => {
    let locals = new Set(state.locals).add(key);

    return {
        ...state,
        locals
    };
};

const updateStateInFunction = (state, isInFunction) => {
    return {
        ...state,
        isInFunction,
    };
};

const validateArgs = (args, span, min = 0, max = Infinity) => {
    const len = args.length;
    if (len < min || len > max) {
        const range =
            max === Infinity ? `at least ${min}` : `from ${min} to ${max}`;
        throw new LispError(`expected ${range} arguments but got \`${len}\``, span);
    }
};

const is = (node, typ) => {
    if (node.type !== typ) {
        throw new LispError(
            `expected \`${typ}\` but got \`${node.type}\``,
            node.span
        );
    }
    return node;
};

const atLeast = (n) => (args, span) => validateArgs(args, span, n);
const exactly = (n) => (args, span) => validateArgs(args, span, n, n);
const between = (m, n) => (args, span) => validateArgs(args, span, m, n);

const args = (node, fun) => {
    is(node, "list");
    fun(node.elements, node.span);
    let res = [...node.elements];
    return res;
};

const mkNil = () => ({
    type: "list",
    elements: [],
});

const specializeMultiple = (nodes, state) => nodes.map((x, i) => specializeExpr(x, state))

/** This function specializes nodes in the format (let ((name expr)*) expr*) */
const specializeLet = (node, state) => {
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
        let value = specializeExpr(newElems.shift(), state);

        name.shadowing = state.locals.has(name.value);
        state = updateStateLocals(state, name.value);

        result.params.push([name, value]);
    }

    result.body = specializeMultiple(body, state);

    return result;
};

/** Specializes nodes in the format (block expr*) */
const specializeBlock = (node, state) => {
    let body = args(node, atLeast(2));
    body.shift(); // Remove the first 'block'

    let specializedBody = specializeMultiple(body, state);

    return {
        type: "block",
        body: specializedBody,
    };
};

/** Specializes nodes in the format (set name expr) */
const specializeSet = (node, state) => {
    let elems = args(node, exactly(3));
    elems.shift(); // Remove the first 'set'

    let name = is(elems.shift(), "identifier");

    let value = specializeExpr(elems.shift(), state);

    return {
        type: "set",
        local: state.locals.has(name.value),
        name,
        value,
        span: node.span,
    };
};

/** Specializes nodes in the format (fn (ident*) expr*) */
const specializeFn = (node, state) => {
    let elems = args(node, atLeast(3));
    elems.shift(); // Remove the first 'fn'

    let fst = elems.shift();
    let params;
    let name;

    if (fst.type != "identifier") {
        params = fst;
    } else {
        args(node, atLeast(4));
        name = fst.value;
        params = elems.shift();
    }

    let paramsElems = is(params, "list").elements;
    params = paramsElems.map((param, index) => {
        let value = is(param, "identifier");
        state = updateStateLocals(state, param.value);

        if (param.value.startsWith("&") && index != paramsElems.length - 1) {
            throw new LispError(`only the last element can be variadic`, param.span);
        }

        return value;
    });

    state = updateStateInFunction(state, true);

    let body = specializeMultiple(elems, state, true);
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
const specializeWhile = (node, state) => {
    let body = args(node, atLeast(2));
    body.shift(); // Remove the first 'block'
    let cond = specializeExpr(body.shift(), state);

    return {
        type: "while",
        cond,
        body: body.map((x) => specializeExpr(x, state)),
    };
};

/** Specializes nodes in the format (macro name) */
const specializeMacro = (node, state) => {
    let elems = args(node, exactly(2));
    elems.shift(); // Remove the first 'macro'

    let name = is(elems.shift(), "identifier");

    return {
        type: "macro",
        name,
        span: node.span,
    };
};

/** Specializes nodes in the format (return name) */
const specializeReturn = (node, state) => {
    let elems = args(node, exactly(2));
    elems.shift(); // Remove the first 'return'

    if (!state.isInFunction) {
        throw new LispError(`cannot use return outside of function`, node.span);
    }

    let value = specializeExpr(elems.shift(), state);

    return {
        type: "return",
        value,
    };
};

const specializeIf = (node, state) => {
    let elems = args(node, between(3, 4));
    elems.shift();

    let cond = specializeExpr(elems.shift(), state);
    let thenBranch = specializeExpr(elems.shift(), state);
    let elseBranch =
        elems.length == 0 ? mkNil() : specializeExpr(elems.shift(), state);

    return {
        type: "if",
        cond,
        then: thenBranch,
        else: elseBranch,
        span: node.span,
    };
};

const specializeExternal = (node, state) => {
    let oldElems = args(node, atLeast(2));
    if (oldElems[1].type == "string") {
        let elems = args(node, exactly(2));
        elems.shift();

        let bindingString = is(elems.shift(), "string");

        return {
            type: "external",
            bindingString,
            span: node.span,
        };
    }

    let elems = args(node, exactly(5));
    elems.shift();

    let name = is(elems.shift(), "identifier");
    const types = ["object", "string", "number", "nil"];

    let paramElems = is(elems.shift(), "list").elements;
    let params = paramElems.map((param, index) => {
        let value = is(param, "identifier");
        state = updateStateLocals(state, param.value);

        const types = ["object", "string", "number", "nil"];
        let type = param.value.startsWith("&") ? param.value.slice(1) : param.value;

        if (param.value.startsWith("&") && index != paramElems.length - 1) {
            throw new LispError(`only the last element can be variadic`, param.span);
        }

        if (!types.includes(type)) {
            throw new LispError(`invalid external type ${type}`, param.span);
        }

        return value;
    });

    let ret = is(elems.shift(), "identifier");

    if (!types.includes(ret.value)) {
        throw new LispError(`invalid external type ${ret.value}`, ret.span);
    }

    let bindingString = is(elems.shift(), "string");

    return {
        type: "external",
        name,
        params,
        ret,
        bindingString,
        span: node.span,
    };
};

const specializeExpr = (node, state) => {
    switch (node.type) {
        case "string":
        case "number":
        case "atom": {
            let expr = {
                ...node
            };
            return expr;
        }
        case "identifier": {
            let type = state.locals.has(node.value) ? "local" : "global";
            let expr = {
                type,
                value: node.value,
                span: node.span
            };
            return expr;
        }
        case "list": {
            if (node.elements.length == 0) {
                return mkNil();
            }

            let nameExpr = args(node, atLeast(1));
            let name = is(nameExpr.shift(), "identifier");

            switch (name.value) {
                case "let":
                    return specializeLet(node, state);
                case "block":
                    return specializeBlock(node, state);
                case "set":
                    return specializeSet(node, state);
                case "fn":
                    return specializeFn(node, state);
                case "quote":
                    return specializeQuote(node, state);
                case "while":
                    return specializeWhile(node, state);
                case "if":
                    return specializeIf(node, state);
                case "macro":
                    return specializeMacro(node, state);
                case "if":
                    return specializeIf(node, state);
                case "return":
                    return specializeReturn(node, state);
                case "external":
                    return specializeExternal(node, state);
                default: {
                    state = updateStateInTail(state, false);

                    let expr = {
                        type: "app",
                        name: specializeExpr(name, state),
                        params: nameExpr.map((x) => specializeExpr(x, state)),
                        span: node.span,
                    };

                    return expr;
                }
            }
        }
    }
};

const specialize = (node) => {
    is(node, "list");
    return specializeExpr(node, {
        locals: new Set(),
        isInFunction: false,
    });
};

export {
    specialize
};