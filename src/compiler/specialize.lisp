(require "./src/std.lisp")
(require "./src/compiler/env.lisp")
(require "./src/compiler/lexer.lisp")
(require "./src/compiler/parser.lisp")

(defn lovelace/between (min-num max-num) (fn (node span)
  (let ((node-length (length node)))
    (when (or (< node-length min-num) (> node-length max-num))
      (throw (concat "expected between " (string min-num) " and " (string max-num) " arguments but got " (string node-length)) span)))))

(defn lovelace/at-least (num) (fn (node span)
    (when (< (length node) num)
        (throw (concat "expected at least " (string num) " arguments but got " (string (length node))) span))))

(defn lovelace/exact (num) (fn (node span)
    (when (!= (length node) num)
        (throw (concat "expected " (string num) " arguments but got " (string (length node))) span))))

(defn lovelace/args (node fun)
    (check node "list")
    (apply fun (list node (span node)))
    node)

(defn lovelace/specialize/let (node)
    (lovelace/args node (lovelace/at-least 3))
    (check (at node 1) "list")

    (list/foreach (at node 1)
        (fn (arg)
            (block
                (check arg "list")
                (lovelace/args arg (lovelace/exact 2))
                (check (at arg 0) "identifier")
                (lovelace/specialize (at arg 1)))))

    (list/foreach (at (list/split node 2) 1) lovelace/specialize))

(defn lovelace/specialize/set* (node)
    (lovelace/args node (lovelace/exact 3))
    (lovelace/specialize (at node 2)))

(defn lovelace/specialize/block (node)
    (lovelace/args node (lovelace/at-least 2))
    (list/foreach (at (list/split node 2) 1) lovelace/specialize))

(defn lovelace/specialize/set (node)
    (lovelace/args node (lovelace/exact 3))
    (lovelace/specialize (at node 2)))

(defn lovelace/specialize/quote (node)
    (lovelace/args node (lovelace/exact 2))
    (lovelace/specialize (at node 1)))

(defn lovelace/specialize/while (node)
  (lovelace/args node (lovelace/at-least 2))
  (let ((condition (lovelace/specialize (at node 1)))
        (body (at (list/split node 2) 1)))
    `(while ,condition @,(list/map body lovelace/specialize))))

(defn lovelace/specialize/while (node)
    (lovelace/args node (lovelace/at-least 2))
    (lovelace/specialize (at node 1))
    (list/foreach (at (list/split node 2) 1) lovelace/specialize))

(defn lovelace/specialize/macro (node)
    (lovelace/args node (lovelace/exact 2)))

(defn lovelace/specialize/if (node)
    (lovelace/args node (lovelace/between 3 4))
    (lovelace/specialize (at node 1))
    (lovelace/specialize (at node 2))
    (if (not (nil? (at node 3)))
        (lovelace/specialize (at node 3))))

(defn lovelace/specialize/fn (node)
    (lovelace/args node (lovelace/at-least 3))

    (let ((labeled? (identifier? (at node 1)))
          (label (if labeled? (at node 1) 'nil-label))
          (params (if labeled? (at node 2) (at node 1)))
          (body (if labeled? (at node 3) (at node 2))))

    (check label "identifier")

    (list/foreach params (fn (param)
      (check param "identifier")))

    (list/foreach body lovelace/specialize)))

(defn lovelace/specialize (node)
   (switch (type node)
        ("string" node)
        ("number" node)
        ("atom" node)
        ("identifier"
          (block
            (print node)
            node))
        ("list"
            (if (= 0 (length node))
                node
                (let ((fst (head node)))
                (cond
                    ((= fst 'let) (lovelace/specialize/let node))
                    ((= fst 'block) (lovelace/specialize/block node))
                    ((= fst 'set*) (lovelace/specialize/set* node))
                    ((= fst 'set) (lovelace/specialize/set node))
                    ((= fst 'fn) (lovelace/specialize/fn node))
                    ((= fst 'quote) (lovelace/specialize/quote node))
                    ((= fst 'while) (lovelace/specialize/while node))
                    ((= fst 'if) (lovelace/specialize/if node))
                    ((= fst 'macro) (lovelace/specialize/macro node))
                    (:true (cons fst (list/map (tail node) lovelace/specialize)))))))))