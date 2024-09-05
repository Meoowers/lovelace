(require "./compiler/std.lisp")

(def-record span
    start
    end)

(def-record token
    type
    value
    span)

(defn tokenize (input)
    (let ((position 0))
    (while (< position (length input))
        (let ((char (at input position)))
        (print char)
        (set position (+ position (length char)))))))

(tokenize "ata (be t)")