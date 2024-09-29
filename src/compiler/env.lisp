(require "./src/std.lisp")

; The current file
(defn lovelace/current-file! ()
    "./compiler/specialize.lisp")

; The entire environment that is running the lisp
(def-record lovelace/environment
    frames
    expanded
    files
    current-file
    current
    values)

(set* environment (lovelace/environment/mk
    (array)    ; frames
    :false     ; expanded
    (dict)
    "none"
    ""
    (dict)))
