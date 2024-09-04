class LispSyntaxError extends Error {
    constructor(message, span) {
        super(`${message} at ${span[0]}-${span[1]}`);
        this.name = "LispSyntaxError";
        this.span = span;
    }
}

/** Checks if a character is whitespace */
const isWhitespace = char => /[\s\n\r\t]/.test(char);

/** Checks if a character can start an identifier */
const isIdentifierStart = char => /[^()"\s\r\n\t]/.test(char);

/** Checks if a character is a digit */
const isDigit = char => /\d/.test(char);

/** Reads characters while predicate is true, starting from index */
const readWhile = (input, predicate, start) => {
    let str = '';
    let end = start;

    while (end < input.length && predicate(input[end])) {
        str += input[end++];
    }

    return { str, end };
}

/** Reads a string literal starting from a given index */
const readString = (input, start) => {
    let { str, end } = readWhile(input, char => char !== '"', start + 1);
    if (end >= input.length || input[end] !== '"') {
        throw new LispSyntaxError("Unclosed string", [start, end]);
    }
    return { type: 'string', value: str, span: [start, end + 1] };
}

/** Reads a number starting from a given index */
const readNumber = (input, start) => {
    const { str, end } = readWhile(input, isDigit, start);
    return { type: 'number', value: Number(str), span: [start, end] };
};

/** Reads an identifier starting from a given index */
const readIdentifier = (input, start) => {
    const { str, end } = readWhile(input, isIdentifierStart, start);
    return { type: 'identifier', value: str, span: [start, end] };
};

/** Returns a token with a given type */
const token = type => (input, start) =>
    ({ type, value: input[start], span: [start, start + 1] });

/** Tokenizes the input string */
const tokenize = input => {
    let tokens = [];
    let i = 0;

    const checkRun = (check, run) => {
        let char = input[i]
        if (check(char)) {
            let token = run(input, i);
            i = token.span[1]
            tokens.push(token)
            return true
        }
        return false
    }

    while (i < input.length) {
        if (isWhitespace(input[i])) {
            i++;
            continue
        }

        if (checkRun(isDigit, readNumber)) continue;
        if (checkRun(isIdentifierStart, readIdentifier)) continue;
        if (checkRun(char => char === '"', readString)) continue;
        if (checkRun(char => char === '(', token('lparen'))) continue;
        if (checkRun(char => char === ')', token('rparen'))) continue;
        throw new LispSyntaxError("Unexpected character", [i, i + 1]);
    }

    return tokens;
};

class LispParseError extends Error {
    constructor(message, span) {
        super(`${message} at ${span[0]}-${span[1]}`);
        this.name = "LispParseError";
        this.span = span;
    }
}

const parseToken = (tokens, pos) => {
    if (pos >= tokens.length) {
        throw new LispParseError("Unexpected end of input", [pos, pos]);
    }
    return { node: tokens[pos], pos: pos + 1 };
}

const parseList = (tokens, pos) => {
    let elements = [];
    pos += 1;
    while (pos < tokens.length) {
        if (tokens[pos].type === 'rparen') {
            return { node: { type: 'list', elements, span: [tokens[pos].span[0], tokens[pos].span[1]] }, pos: pos + 1 };
        }
        const { node, pos: newPos } = parseExpression(tokens, pos);
        elements.push(node);
        pos = newPos;
    }
    throw new LispParseError("Unclosed list", [tokens[pos - 1].span[0], tokens[pos - 1].span[1]]);
}

const parseExpression = (tokens, pos) => {
    let token = tokens[pos];

    if (token.type === 'lparen') {
        return parseList(tokens, pos);
    }

    // handle simple types
    if (['identifier', 'number', 'string'].includes(token.type)) {
        return parseToken(tokens, pos);
    }

    throw new LispParseError(`Unexpected token '${token.type}'`, token.span);
}

/** Parses a list of tokens into an abstract syntax tree (AST) */
const parse = tokens => {
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
        super(`${message} at ${span[0]}-${span[1]}`);
        this.name = "LispCompilationError";
        this.span = span;
    }
}

const is = (node, typ) => {
    if (node.type != typ) {
        throw new LispCompilationError(`expected \`${typ}\` but got \`${node.type}\``, node.span)
    }
    return node
}

const atLeast = n => (args, span) => {
    if (args.length < n) {
        throw new LispCompilationError(`expected at least \`${n}\` arguments but got \`${args.length}\``, span)
    }
}

const exactly = n => (args, span) => {
    if (args.length != n) {
        throw new LispCompilationError(`expected \`${n}\` arguments but got \`${args.length}\``, span)
    }
}

const args = (node, fun) => {
    is(node, 'list')
    fun(node.elements, node.span)
    let res = [...node.elements]
    return res
}

// Specialize

/** This function specializes nodes in the format (let ((name expr)*) expr*) */
const specializeLet = (node) => {
    let result = { type: 'let', params: [], body: [], span: node.span }

    let body = args(node, atLeast(3))
    body.shift() // Remove the first 'let'

    let elems = is(body.shift(), 'list').elements

    for (const elem of elems) {
        let newElems = args(elem, exactly(2))

        let name = is(newElems.shift(), 'identifier')
        let value = specializeExpr(newElems.shift())

        result.params.push([name, value])
    }

    result.body = body.map(specializeExpr)

    return result
}

/** Specializes nodes in the format (block expr*) */
const specializeBlock = (node) => {
    let body = args(node, atLeast(2))
    body.shift() // Remove the first 'block'

    return {
        type: 'block',
        body: body.map(specializeExpr)
    }
}

/** Specializes nodes in the format (set name expr) */
const specializeSet = (node) => {
    let elems = args(node, exactly(3))
    elems.shift() // Remove the first 'set'

    let name = is(elems.shift(), 'identifier')
    let value = specializeExpr(elems.shift())

    return {
        type: 'set',
        name,
        value, span: node.span
    }
}

/** Specializes nodes in the format (fn (ident*) expr) */
const specializeFn = (node) => {
    let elems = args(node, exactly(3))
    elems.shift() // Remove the first 'fn'

    let params = is(elems.shift(), 'list').elements.map(param => is(param, 'identifier'))
    let body = specializeExpr(elems.shift())

    return {
        type: 'fn',
        params,
        body, span: node.span
    }
}

/** Specializes nodes in the format (quote expr) */
const specializeQuote = (node) => {
    let elems = args(node, exactly(2))
    elems.shift() // Remove the first 'quote'

    return {
        type: 'quote',
        value: elems.shift(), span: node.span
    }
}

/** Specializes nodes in the format (macro name) */
const specializeMacro = (node) => {
    let elems = args(node, exactly(2))
    elems.shift() // Remove the first 'macro'

    let name = is(elems.shift(), 'identifier')

    return {
        type: 'macro',
        name, span: node.span
    }
}

const specializeIf = (node) => {
    let elems = args(node, exactly(4))
    elems.shift()

    let cond = specializeExpr(elems.shift())
    let thenBranch = specializeExpr(elems.shift())
    let elseBranch = specializeExpr(elems.shift())

    return {
        type: 'if',
        cond,
        then: thenBranch,
        else: elseBranch, span: node.span
    }
}

const specializeExpr = (node) => {
    switch (node.type) {
        case 'identifier':
        case 'string':
        case 'number': return node
        case 'list': {
            let nameExpr = args(node, atLeast(1))
            let name = is(nameExpr.shift(), 'identifier')
            switch (name.value) {
                case 'let': return specializeLet(node)
                case 'block': return specializeBlock(node)
                case 'set': return specializeSet(node)
                case 'fn': return specializeFn(node)
                case 'quote': return specializeQuote(node)
                case 'if': return specializeIf(node)
                case 'macro': return specializeMacro(node)
                default: return { type: 'app', name, params: nameExpr.map(specializeExpr), span: node.span }
            }
        }
    }
}

const specialize = node => {
    is(node, 'list');
    return specializeExpr(node)
}

// Checker

const generate = (node, scope = new Set(), quote = false) => {
    switch (node.type) {
        case 'identifier':
            if (quote) {
                return JSON.stringify(node)
            }

            if (scope.has(node.value)) {
                return node.value; // Local reference
            } else {
                return `__env.__find("${node.value}")`; // Global reference
            }
        case 'string':
        case 'number':
        case 'list':
            return JSON.stringify(node)
        case 'let':
            const letBindings = node.params.map(([name, value]) => {
                const jsValue = generate(value, scope);
                scope.add(name.value);
                return `let ${name.value} = ${jsValue};`;
            }).join(' ');

            const letBody = node.body.map(expr => generate(expr, scope)).join(' ');
            return `(() => {${letBindings} return ${letBody})()`;

        case 'block':
            const blockBody = node.body.map((expr, index) => {
                if (index === node.body.length - 1) {
                    return `return ${generate(expr, scope)};`;
                }
                return `${generate(expr, scope)};`;
            }).join(' ');

            return `(() => { ${blockBody} })()`;

        case 'set':
            const setValue = generate(node.value, scope);
            return `(() => {__env.__values["${node.name.value}"] = {"value": ${setValue}};return __genNil()})()`;

        case 'fn':
            const fnScope = new Set(scope);

            const fnParams = node.params.map((param) => {
                if (param.value.startsWith('&')) {
                    fnScope.add(param.value.slice(1));
                    return `let ${param.value.slice(1)} = {type: "list", elements: [...__args]};`;
                } else {
                    fnScope.add(param.value);
                    return `let ${param.value} = __args.shift();`;
                }
            }).join(' ');

            const fnArgsCheck = node.params.some(param => param.value.startsWith('&'))
                ? `__atLeastArgs(__args, ${node.params.length - 1}, ${JSON.stringify(node.span)});`
                : `__exactArgs(__args, ${node.params.length}, ${JSON.stringify(node.span)});`;

            const fnBody2 = generate(node.body, fnScope);

            return `{ type: "closure", value: (__args) => {
                    ${fnArgsCheck}
                    ${fnParams}
                    return ${fnBody2};
                }}`;

        case 'if':
            const cond = generate(node.cond, scope);
            const thenBranch = generate(node.then, scope);
            const elseBranch = generate(node.else, scope);
            return `(__toBool(${cond})) ? ${thenBranch} : ${elseBranch}`;

        case 'quote':
            return JSON.stringify(node.value);

        case 'macro':
            return `(() => {__env.__values["${node.name.value}"].macro = true; return __genNil()})()`;

        case 'app':
            const appName = generate(node.name, scope);
            const appParams = node.params.map(param => generate(param, scope)).join(', ');
            return `__call(${appName},[${appParams}], ${JSON.stringify(node.span)})`;

        default:
            throw new Error(`Unknown node type: ${node.type}`);
    }
};

// Runtime

const __genTrue = () => ({ type: 'identifier', value: 'true' })
const __genFalse = () => ({ type: 'identifier', value: 'false' })
const __genNil = () => ({ type: 'list', elements: [] })
const __genNum = (n) => ({ type: 'number', value: n })

const __toBool = (arg) => {
    switch (arg.type) {
        case 'number': return arg.value != 0
        case 'string': return arg.value.length != 0
        case 'identifier': return arg.value != "false"
    }
}

const __atLeastArgs = (args, n, span) => {
    if (args.length < n) {
        throw new LispCompilationError(`expected at least \`${n}\` arguments but got \`${args.length}\``, span)
    }
}


const __exactArgs = (args, n, span) => {
    if (args.length != n) {
        throw new LispCompilationError(`expected \`${n}\` arguments but got \`${args.length}\``, span)
    }
}

const __check = (arg, typ, span) => {
    if (arg.type != typ) {
        throw new LispCompilationError(`expected \`${typ}\` but got \`${arg.type}\``, span)
    }
    return arg
}

const __call = (arg, args, span) => {
    if (arg.type != 'closure') {
        throw new LispCompilationError(`cannot apply a \`${arg.type}\``, span)
    }

    return arg.value(args, span)
}

let toStr = (x) => {
    switch (x?.type) {
        case 'list': return `(${x.elements.map(toStr).join(" ")})`
        case 'number': return x.value.toString()
        case 'string': return JSON.stringify(x.value)
        case 'identifier': return x.value
        case 'closure': return '<closure>'
        default: return `{${x}}`
    }
}

const __env = {
    __expanded: false,
    __values: {
        "cons?": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 1, span)
                    let elem = args.shift();

                    if (elem.type == 'list' && elem.elements.length > 0) {
                        return __genTrue()
                    } else {
                        return __genFalse()
                    }
                }
            }
        },
        "cons": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)

                    let head = args.shift();
                    let elem = args.shift();

                    if (elem.type == 'list') {
                        return { type: 'list', elements: [head, ...elem.elements], span: elem.span }
                    } else {
                        return { type: 'list', elements: [head, elem] }
                    }
                }
            }
        },
        "head": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 1, span)

                    let elem = args.shift();

                    if (elem.type == 'list' && elem.elements.length > 0) {
                        return elem.elements[0]
                    } else {
                        return __genNil()
                    }
                }
            }
        },
        "tail": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 1, span)

                    let elem = args.shift();

                    if (elem.type == 'list' && elem.elements.length > 0) {
                        let elements = [...elem.elements];
                        elements.shift()
                        return { type: 'list', elements, span: elem.span }
                    } else {
                        return __genFalse()
                    }
                }
            }
        },
        "+": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)
                    let a = __check(args.shift(), 'number');
                    let b = __check(args.shift(), 'number');
                    return __genNum(parseInt(a.value) + parseInt(b.value))
                }
            }
        },
        "-": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)
                    let a = __check(args.shift(), 'number');
                    let b = __check(args.shift(), 'number');
                    return __genNum(parseInt(a.value) - parseInt(b.value))
                }
            }
        },
        "<": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)
                    let a = __check(args.shift(), 'number');
                    let b = __check(args.shift(), 'number');
                    return a.value < b.value ? __genTrue() : __genFalse()
                }
            }
        },
        "check": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)
                    let elem = args.shift();
                    let type = __check(args.shift(), 'string');

                    __check(elem, type.value)

                    return __genNil()
                }
            }
        },
        "list": {
            value: {
                type: 'closure', value: (args) => {
                    return { type: 'list', elements: args }
                }
            }
        },
        "print": {
            value: {
                type: 'closure', value: (args) => {
                    console.log(args.map(toStr).join(" "))
                    return __genNil()
                }
            }
        },
        "eq": {
            value: {
                type: 'closure', value: (args, span) => {
                    __exactArgs(args, 2, span)

                    let areEqual = (a, b) => {
                        if (a.type !== b.type) {
                            return false;
                        }

                        switch (a.type) {
                            case 'list':
                                if (a.elements.length !== b.elements.length) return false;
                                return a.elements.every((el, idx) => areEqual(el, b.elements[idx]));
                            case 'number':
                            case 'string':
                            case 'identifier':
                                return a.value === b.value;
                            case 'closure':
                                return false; // closures are not comparable by value
                            default:
                                return false;
                        }
                    }

                    return areEqual(args[0], args[1]) ? __genTrue() : __genFalse()
                }
            }
        },
    },
    __find: (name) => {
        if (!__env.__values[name]) {
            throw new LispCompilationError(`cannot find variable \`${name}\``, [0, 0])
        }

        return __env.__values[name].value
    }
}

// Expand

const expand = (node, first) => {
    switch (node.type) {
        case 'identifier': {
            let res = __env.__values[node.value];
            if (res && res.macro && first) {
                __env.__expanded = true;
                return res.value
            }
            return node
        }
        case 'string':
        case 'number': return node
        case 'list': {
            let elements = node.elements.map((x, idx) => expand(x, idx == 0));

            if (elements.length > 0 && elements[0].type == 'closure') {
                let args = [...elements]
                args.shift()
                return __call(elements[0], args, node.span)
            } else {
                return { type: 'list', elements, span: node.span }
            }
        }
    }
}

// Error


// Test

const run = (input) => {
    let l = tokenize(input)
    let parts = parse(l)

    try {
        for (const listParsed of parts) {
            let expanded = listParsed

            do {
                __env.__expanded = false
                expanded = expand(expanded)
            } while (__env.__expanded)

            let specialized = specialize(expanded)
            let code = generate(specialized)

            eval(code)
        }
    } catch (err) {
        if (err instanceof LispSyntaxError || err instanceof LispCompilationError || err instanceof LispParseError) {
            console.error(err.message)
        } else {
            throw err
        }
    }
}


run(`
(set map (fn (f expr)
    (block
        (check f "closure")
        (check expr "list")
        (if (cons? expr)
            (cons (f (head expr)) (map f (tail expr)))
            expr))))

(set quasi-quote (fn (expr)
    (if (cons? expr)
        (if (eq (quote unquote) (head expr))
            (head (tail expr))
            (cons (quote list) (map quasi-quote expr)))
        (list (quote quote) expr))))

(macro quasi-quote)

(set def-macro (fn (name args body)
    (quasi-quote
        (block
            (set (unquote name) (fn (unquote args) (unquote body)))
            (macro (unquote name))))))

(macro def-macro)

(def-macro defn (name args &body)
    (quasi-quote
        (set (unquote name) (fn (unquote args) (unquote (cons (quote block) body))))))

(macro defn)

(defn fib (num)
    (if (< num 2)
        num
        (+ (fib (- num 1)) (fib (- num 2)))))

(print (fib 10))
`)