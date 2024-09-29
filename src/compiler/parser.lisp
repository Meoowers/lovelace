(require "./src/std.lisp")
(require "./src/compiler/env.lisp")
(require "./src/compiler/lexer.lisp")

(defn parser/parse-list (tokens start pos)
    (let ((elements (list))
          (start-pos pos)
          (result ()))

    (while (and (< pos (length tokens)) (nil? result))
        (let ((token (at tokens pos)))
        (cond
            ((= (token/type token) "rpar")
                (set result (set-span elements (span/to-list (span/mix start (token/span token))))))
            (:true
                (let ((result (parser/parse-expression tokens pos))
                      (new-pos (at result 0))
                      (node (at result 1)))
                (set elements (push elements node))
                (set pos new-pos))))))

    (if (= pos (length tokens))
        (let ((token (at tokens (- start-pos 1))))
        (compiler/error (concat "unfinished list") (token/span token))))

    (list (+ pos 1) result)))

(defn parser/parse-expression (tokens pos)
    (let ((token (at tokens pos)))
    (cond
        ((= "lpar" (token/type token))
            (parser/parse-list tokens (token/span token) (+ pos 1)))
        ((list/includes (list "identifier" "number" "string" "atom") (token/type token))
            (list (+ pos 1) (set-span (token/value token) (span/to-list (token/span token)))))
        ((list/includes (list "quote" "unquote" "quasi-quote" "unsplice-quote") (token/type token))
            (let ((result (parser/parse-expression tokens (+ pos 1)))
                  (new-pos (at result 0))
                  (node (at result 1))
                  (name (set-span (identifier (token/type token)) (span/to-list (token/span token))))
                  (new-span (span/mix (token/span token) (span/of-list (span node)))))
            (list new-pos (set-span (list name node) (span/to-list new-span)))))
        (:true (compiler/error (concat "unexpected token " (token/type token)) (token/span token))))))

(defn lovelace/parse (tokens)
    (let ((elements ())
          (pos 0))

    (while (< pos (length tokens))
        (if (= "lpar" (token/type (at tokens pos)))
            (block
                (let ((result (parser/parse-list tokens (token/span (at tokens 0)) (+ pos 1)))
                      (new-pos (at result 0))
                      (node (at result 1)))
                (set pos new-pos)
                (set elements (push elements node))))
            (compiler/error (concat "unexpected token " (string (at tokens pos))) (token/span (at tokens pos)))))

    elements))