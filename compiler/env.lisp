(require "./compiler/std.lisp")

; The current file
(defn lovelace/current-file! ()
    "nothing")

; The entire environment that is running the lisp
(def-record lovelace/environment
    frames
    expanded
    files
    current-file
    current
    value)

(set* lovelace/env (lovelace/environment/mk
    (list 1 2)
    ()
    ()
    ()
    ()
    ()))