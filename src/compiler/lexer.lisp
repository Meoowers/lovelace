(require "./src/std.lisp")
(require "./src/compiler/env.lisp")

(defn lovelace/is-name? (char)
    (and (!= char "(") (!= char ")") (!= char " ") (!= char "\n") (!= char "\t") (!= char "\r")
         (!= char "\"") (!= char ";")))

(defn lovelace/is-number? (char)
    (and (>= char "0") (<= char "9")))

(defn lovelace/is-useless? (char)
    (or (= char " ") (=  char "\t") (= char "\n") (= char "\r")))

; The token of span.
(def-record span start end)

(defn span/to-list (span)
    (list (span/start span) (span/end span)))

(defn span/of-list (span)
    (span/mk (at span 0) (at span 1)))

(defn span/mix (start end)
    (span/mk (span/start start) (span/end end)))

; The token record, that stores the type value and span
(def-record token type value span)

; Throws an error and substitus the span and file for other ones.
(defn compiler/error (message span)
    (throw (concat message " ") (list (span/start span) (span/end span)) (lovelace/current-file!))
    (exit 1))

; Accumulates a bunch of tokens
(defn lexer/accumulate (input f index)
    (let ((end index))

    (while (and (< end (length input)) (f (at input end)))
        (set end (+ end 1)))

    (list (string/substring input index end) end)))

; Accumulates a bunch of tokens
(defn lexer/accumulate-map (input f index)
    (let ((end index)
          (result ""))

    (while (and (< end (length input)) (f (at input end)))
        (set result (concat result (f (at input end))))
        (set end (+ end 1)))

    (list result end)))

; Accumulates a bunch of tokens
(defn lexer/read-string (input index)
    (let ((end (+ index 1))
          (result "")
          (escaped ())
          (cont :true))

    (while (and (< end (length input)) cont)
        (let ((char (at input end)))
        (if escaped
            (block
                (cond
                    ((= char "n") (set result (concat result "\n")))
                    ((= char "t") (set result (concat result "\t")))
                    ((= char "r") (set result (concat result "\r")))
                    ((= char "\\") (set result (concat result "\\")))
                    ((= char "\"") (set result (concat result "\"")))
                    (:true (set result (concat result char))))
                (set escaped ()))
            (block
                (cond
                    ((= char "\\") (set escaped :true))
                    ((= char "\"") (set cont ()))
                    (:true (set result (concat result char)))))))
        (set end (+ end 1)))

    (if cont
        (compiler/error "unfinished string" (span/mk index end)))

    (token/mk "string" result (span/mk index end))))

(defn lexer/read-identifier (input index)
    (let ((result (lexer/accumulate input lovelace/is-name? index))
          (str (at result 0))
          (end (at result 1)))
    (token/mk "identifier" (identifier str) (span/mk index end))))

(defn lexer/read-number (input index)
  (let ((result (lexer/accumulate input lovelace/is-number? index))
        (str (at result 0))
        (end (at result 1)))
    (token/mk "number" (int str) (span/mk index end))))

(defn lexer/read-atom (input index)
  (let ((result (lexer/accumulate input lovelace/is-name? (+ index 1)))
        (str (at result 0))
        (end (at result 1)))
    (token/mk "atom" (atom str) (span/mk index end))))

(defn lexer/make-token (type input index)
    (token/mk type (at input index) (span/mk index (+ index 1))))

(defn lexer/token (input pos)
    (let ((char (at input pos)))

    (if (< pos (length input))
        (cond
            ((= char "\"") (lexer/read-string input pos))
            ((= char "`") (lexer/make-token "quasi-quote" input pos))
            ((= char ",") (lexer/make-token "unquote" input pos))
            ((= char "\'") (lexer/make-token "quote" input pos))
            ((= char "(") (lexer/make-token "lpar" input pos))
            ((= char ")") (lexer/make-token "rpar" input pos))
            ((= char ":") (lexer/read-atom input pos))
            ((lovelace/is-useless? char) (lexer/token input (+ pos 1)))
            ((lovelace/is-number? char) (lexer/read-number input pos))
            (:true (lexer/read-identifier input pos)))
        (token/mk "eof" pos (span/mk pos (+ pos 1))))))

(defn lovelace/tokenize (input)
    (let ((index 0)
          (tokens ()))

    (while (< index (length input))
        (let ((tkn (lexer/token input index)))

        (unless (= (token/type tkn) "eof")
            (set tokens (push tokens tkn)))

        (set index (span/end (token/span tkn)))))

    tokens))