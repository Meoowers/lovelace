; Boolean primitives

(require "./src/std/basic.lisp")
(require "./src/std/list.lisp")

; Logical `and` macro that evaluates multiple conditions.
(defm and (&args)
    (if (cons? args)
        `(if ,(head args) ,(apply and (tail args)) ())
        :true))

; Logical `or` macro that evaluates multiple conditions.
(defm or (&args)
    (if (cons? args)
        `(if ,(head args) :true ,(apply or (tail args)))
        :false))

; Unless defines the unless function that is used as if (not condition).
(defm unless (condition &body)
    `(if (not ,condition)
        ,(cons 'block body)))

; Unless defines the unless function that is used as if (condition).
(defm when (condition &body)
    `(if ,condition
        ,(cons 'block body)))

; Helper function to compile a switch case arm.
(defn switch/arm (c acc arm)
    (check arm "list")

    (if (< (length arm) 2)
        (throw (concat "expected at least 2 arguments") (span arm)))

    (let ((condition (at arm 0))
          (evaluator (tail arm)))

    `(if (= ,c ,condition) ,(cons 'block evaluator) ,acc)))

; Macro for a switch/case statement.
(defm switch (c &arms)
    (let ((body (list/fold arms `(throw (concat "no match " (string ,c)) ',(span c)) (fn (acc arm) (switch/arm '_condition_ acc arm)))))
    `(let ((_condition_ ,c)) ,body)))

; Helper function for compiling condition arms in `cond`.
(defn cond/arm (acc arm)
    (check arm "list")

    (if (< (length arm) 2)
        (throw (concat "Expected at least 2 arguments but got " (string (length arm))) (span arm)))

    (let ((condition (at arm 0))
          (evaluator (at arm 1)))

    `(if ,condition ,evaluator ,acc)))

; Macro for defining conditional expressions (`cond`).
(defm cond (&arms)
    (list/fold (list/reverse arms) `(throw (concat "cond: no match")) cond/arm))

; Compiles a list pattern for the `case` macro.
(defn case/compile-list (place pattern defs)
    (if (= 'unquote (at pattern 0))
        (block
            (dict/set defs (at pattern 1) place)
            :true)
        (block
            (let ((last-elem (last pattern))
                (comp (if (string/starts (string last-elem) "&")
                            `(>= (length ,place) ,(length pattern))
                            `(= (length ,place) ,(length pattern))))
                (rest-conds (list/map-idx pattern (fn (m i) (case/compile-term `(at ,place ,i) m defs)) 0)))
            (cons (quote and) (cons `(= (type ,place) "list") (cons comp (filter rest-conds cons?))))))))

; Compiles a term in `case`.
(defn case/compile-term (place term defs)
    (switch (type term)
          ("atom" `(and (= (type ,place) "atom") (= ,place ,term)))
          ("string" `(and (= (type ,place) "string") (= ,place ,term)))
          ("number" `(and (= (type ,place) "number") (= ,place ,term)))
          ("identifier" `(= ,place ',term))
          ("list" (case/compile-list place term defs))))

; Helper function for handling `case` arms.
(defn case/arm (d acc arm)
    (check arm "list")

    (if (!= (length arm) 2)
        (throw (concat "Expected 2 arguments") (span arm)))

    (let ((condition (at arm 0))
          (evaluator (at arm 1))
          (current-dict (dict))
          (condition1 (case/compile-term '__c condition current-dict)))

    `(if ,condition1 (let ,(dict/to-list current-dict) ,evaluator) ,acc)))

; Macro for a pattern-matching `case` statement.
(defm case (d &arms)
    (let ((body (list/foldr arms `(throw (concat "case: no match!") (span __c)) (fn (acc arm) (case/arm `__c acc arm)))))
    `(let ((__c ,d)) ,body)))