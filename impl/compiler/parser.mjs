import { LispError } from './error.mjs'

const parseToken = (tokens, pos) => {
    if (pos >= tokens.length) {
        throw new LispError("Unexpected end of input", [pos, pos + 1]);
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

    throw new LispError("Unclosed list", [start, tokens[pos - 1].span[1]]);
};

const parseExpression = (tokens, pos) => {
    let token = tokens[pos];

    if (token.type === "lparen") {
        return parseList(tokens, token.span[0], pos);
    }

    if (["identifier", "number", "string", "atom"].includes(token.type)) {
        return parseToken(tokens, pos);
    }

    const quoteTypes = ["quote", "unquote", "quasi-quote", "unsplice-quote"];

    if (quoteTypes.includes(token.type)) {
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

    throw new LispError(`unexpected token '${token.type}'`, token.span);
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

export { parse }