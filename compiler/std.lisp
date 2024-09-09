; Applies a function `f` to each element of the list `list`.
(set* map (fn map (list f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (cons (f (head list)) (map (tail list) f))
            list))))

; Like `map`, but passes an index to the function `f`.
(set* map-idx (fn map-idx (list f index)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (cons (f (head list) index) (map-idx (tail list) f (+ index 1)))
            list))))

(set* reverse/inner (fn reverse/inner (list acc)
    (if (cons? list)
        (reverse/inner (tail list) (cons (head list) acc))
        acc)))

(set* reverse (fn reverse (list)
    (block
        (check list "list")
        (reverse/inner list ()))))

; Filters a list `list` based on a predicate `pred`.
(set* filter (fn filter (list pred)
    (block
        (check pred "closure")
        (check list "list")
        (if (cons? list)
            (if (pred (head list))
                (cons (head list) (filter (tail list) pred))
                (filter (tail list) pred))
            list))))

; Appends `list2` to `list1`, returning a combined list.
(set* append (fn append (list1 list2)
    (block
        (check list1 "list")
        (check list2 "list")
        (if (cons? list1)
            (cons (head list1) (append (tail list1) list2))
            list2))))

; Partially applies arguments `args` to a function `f`, returning a new function.
(set* partial (fn partial (f &args)
    (fn (&rest)
        (apply f (append args rest)))))

; Reduces `list` into a single value by accumulating with function `f`.
(set* fold (fn fold (list acc f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (fold (tail list) (f acc (head list)) f)
            acc))))

; Like `fold`, but applies `f` from the right side of the list.
(set* foldr (fn foldr (list acc f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (f (foldr (tail list) acc f) (head list))
            acc))))

; Returns the last element in a list.
(set* last (fn last (list)
    (block
        (check list "list")
        (if (cons? (tail list))
            (last (tail list))
            (head list)))))

; Macro for quoting a list, allowing quasi-quoting (templates).
(set* quasi-quote (fn quasi-quote (expr)
    (if (cons? expr)
        (if (= 'unquote (head expr))
            (head (tail expr))
            (cons 'list (map expr quasi-quote)))
        (list 'quote expr))))

(macro quasi-quote)

; Macro for defining new macros. Example: `(defm name args &body)`.
(set* defm (fn defm (name args &body)
    `(block
        (set* ,name (fn ,name ,args ,(cons `block body)))
        (macro ,name))))

(macro defm)

; Macro for defining functions. Example: `(defn name args &body)`.
(defm defn (name args &body)
    `(set* ,name (fn ,name ,args ,(cons `block body))))

; Logical `and` macro that evaluates multiple conditions.
(set* and (fn (&args)
    (if (cons? args)
        `(if ,(head args) ,(apply and (tail args)) ())
        :true)))

(macro and)

; Logical `or` macro that evaluates multiple conditions.
(set* or (fn (&args)
    (if (cons? args)
        `(if ,(head args) :true ,(apply or (tail args)))
        :false)))

(macro or)

; Unless defines the unless function that is used as if (not condition).
(defm unless (condition &body)
    `(if (not ,condition)
        ,(cons :block body)))

; Unless defines the unless function that is used as if (condition).
(defm when (condition &body)
    `(if (,condition)
        ,(cons :block body)))

; Helper function to compile a switch case arm.
(defn switch/arm (c acc arm)
    (check arm "list")

    (if (!= (length arm) 2)
        (throw (concat "Expected 2 arguments") (span arm)))

    (let ((condition (at arm 0))
          (evaluator (at arm 1)))

    `(if (= ,c ,condition) ,evaluator ,acc)))

; Macro for a switch/case statement.
(defm switch (c &arms)
    (let ((body (fold arms `(throw (concat "no match " (string ,c)) ',(span c)) (fn (acc arm) (switch/arm '_condition_ acc arm)))))
    `(let ((_condition_ ,c)) ,body)))

; Helper function for compiling condition arms in `cond`.
(defn cond/arm (acc arm)
    (check arm "list")

    (if (!= (length arm) 2)
        (throw (concat "Expected 2 arguments but got " (string (length arm))) (span arm)))

    (let ((condition (at arm 0))
          (evaluator (at arm 1)))

    `(if ,condition ,evaluator ,acc)))

; Macro for defining conditional expressions (`cond`).
(defm cond (&arms)
    (fold (reverse arms) `(throw (concat "cond: no match")) cond/arm))

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
                (rest-conds (map-idx pattern (fn (m i) (case/compile-term `(at ,place ,i) m defs)) 0)))
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
    (let ((body (foldr arms `(throw (concat "case: no match!") (span __c)) (fn (acc arm) (case/arm `__c acc arm)))))
    `(let ((__c ,d)) ,body)))

(defm def-record (name &fields)
    (let ((mk `(defn ,(concat name '/mk) ,fields (dict/of-list ,(cons 'list (map fields (fn (x) `(list ,(atom x) ,x)))))))
          (get-fields (map fields (fn (field) `(defn ,(concat name '/ field) (data) (dict/get data ,(atom field))))))
          (set-fields (map fields (fn (field) `(defn ,(concat name '/ field '/set) (dict data) (dict/set dict ,(atom field) data)))))
          (rest (concat set-fields get-fields)))
         (cons 'block (cons mk rest))))

(defm def-external (name params ret str)
    (check name "identifier")
    (check params "list")
    (check ret "identifier")
    (check str "string")

    (map params (fn (arm) (block
        (if (!= (length arm) 2)
            (throw (concat "Expected 2 arguments") (span arm)))

        (check (at arm 0) "identifier")
        (check (at arm 1) "identifier"))))

    (let ((params (map params (fn (x) (at x 0)))))
    `(defn ,name ,params
        (block
            (unsafe-from-js-obj ,(cons 'unsafe-eval (cons str params)) ,(string ret))))))

(def-external prim_add ((a number) (b number)) number
    "(x, y) => x + y")

(defn + (x &rest)
    (check x "number")
    (let ((result x)
          (index 0))

    (while (< index (length rest))
        (set result (prim_add result (at rest index)))
        (set index (prim_add index 1)))

    result))