; Imports to all of the categories

(require "./src/std.lisp")
(require "./src/compiler/env.lisp")
(require "./src/compiler/lexer.lisp")
(require "./src/compiler/parser.lisp")
(require "./src/compiler/specialize.lisp")

(set* code "(set* a (let ((a 2)) 3))")

(defn at-inv (x arr)
    (at arr x))

(set* m (|> code
    lovelace/tokenize
    lovelace/parse))

(|> (at m 0) lovelace/specialize print)