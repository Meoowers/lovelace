import { tokenize } from './compiler/lexer.mjs'
import { parse } from './compiler/parser.mjs'
import { specialize } from './compiler/specialize.mjs'

import { readFileSync } from 'fs'

let allStatements = parse(tokenize(readFileSync("../tutorial.lisp", "utf-8")));

for (let sttm of allStatements) {
  console.log(JSON.stringify(specialize(sttm), null, 4))
}
