(require "./compiler/std.lisp")
(require "./compiler/env.lisp")

(defn lovelace/is-name? (char)
    (and (!= char "(") (!= char ")") (!= char " ") (!= char "\n") (!= char "\t") (!= char "\r")
         (!= char "\"") (!= char ";")))

(defn lovelace/is-number? (char)
    (and (>= char "0") (<= char "9")))

(defn lovelace/is-useless? (char)
    (or (= char " ") (=  char "\t") (= char "\n") (= char "\r")))

; The token of span.
(def-record span start end)

; The token record, that stores the type value and span
(def-record token type value span)

; Throws an error and substitus the span and file for other ones.
(defn tokenize/error (message span)
    (throw (concat message " ") (list (span/start span) (span/end span)) (lovelace/current-file!))
    (exit 1))

; Accumulates a bunch of tokens
(defn tokenize/accumulate (input f index)
    (let ((end index))

    (while (and (< end (length input)) (f (at input end)))
        (set end (+ end 1)))

    (list (string/substring input index end) end)))

; Accumulates a bunch of tokens
(defn tokenize/accumulate-map (input f index)
    (let ((end index)
          (result ""))

    (while (and (< end (length input)) (f (at input end)))
        (set result (concat result (f (at input end))))
        (set end (+ end 1)))

    (list result end)))

; Accumulates a bunch of tokens
(defn tokenize/read-string (input index)
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
        (tokenize/error "unfinished string" (span/mk index end)))

    (token/mk "string" result (span/mk index end))))

(defn tokenize/read-identifier (input index)
    (let ((result (tokenize/accumulate input lovelace/is-name? index))
          (str (at result 0))
          (end (at result 1)))
    (token/mk "identifier" str (span/mk index end))))

(defn tokenize/read-number (input index)
  (let ((result (tokenize/accumulate input lovelace/is-number? index))
        (str (at result 0))
        (end (at result 1)))
    (token/mk "number" (number/parse str) (span/mk index end))))

(defn tokenize/read-atom (input index)
  (let ((result (tokenize/accumulate input lovelace/is-name? (+ index 1)))
        (str (at result 0))
        (end (at result 1)))
    (token/mk "atom" str (span/mk index end))))

(defn tokenize/make-token (type) (fn (input index)
    (token/mk type (at input index) (span/mk index (+ index 1)))))

(defn tokenize/token (input pos)
    (let ((char (at input pos)))
    (cond
        ((= char "\"") (tokenize/read-string input pos))
        ((= char "`") (tokenize/make-token "quasi-quote"))
        ((= char ",") (tokenize/make-token "unquote"))
        ((= char "\'") (tokenize/make-token "quote"))
        ((= char "(") (tokenize/make-token "lpar"))
        ((= char ")") (tokenize/make-token "rpar"))
        ((lovelace/is-useless? char) (tokenize/token input (+ pos 1)))
        ((lovelace/is-name? char) (tokenize/read-identifier input pos))
        ((lovelace/is-number? char) (tokenize/read-identifier input pos)))))

(defn tokenize/tokenize (input)
    (let ((index 0)
          (tokens ()))

    (while (< index (length input))
        (let ((token (tokenize/token input index)))
        (set tokens (push token tokens))
        (set index (span/end (token/span token)))))

    tokens))