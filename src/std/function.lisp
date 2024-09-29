; Function primitives

(require "./src/std/basic.lisp")
(require "./src/std/list.lisp")
(require "./src/std/bool.lisp")

; Forward composition
(defm |> (first &rest)
    (list/fold rest first (fn (acc cur) (list cur acc))))

; Backwards composition
(defm <| (&rest)
    (let ((rest (list/reverse rest)))
    (list/fold (tail rest) (head rest) (fn (acc cur) (list cur acc)))))

; Partially applies arguments `args` to a function `f`, returning a new function.
(defn partial (f &args)
    (fn (&rest) (apply f (list/append args rest))))

; Defines an external thing to call from javascript.
(defm external (name params ret str)
    (check name "identifier")
    (check params "list")
    (check ret "identifier")
    (check str "string")

    (list/map params (fn (arm) (block
        (if (!= (length arm) 2)
            (throw (concat "Expected 2 arguments") (span arm)))

        (check (at arm 0) "identifier")
        (check (at arm 1) "identifier"))))

    (let ((params-names (list/map params (fn (x) (at x 0))))
          (checks (list/map params (fn (x) `(check ,(at x 0) ,(string (at x 1))))))
          (call `(%unsafe-from-js-obj ,(cons '%unsafe-eval (cons str params-names)) ,(string ret))))

    `(defn ,name ,params-names
        ,(cons 'block (list/append checks (list call))))))

(defm def-record (name &fields)
    (let ((mk `(defn ,(concat name '/mk) ,fields (dict/of-list ,(cons 'list (list/map fields (fn (x) `(list ,(atom x) ,x)))))))
          (get-fields (list/map fields (fn (field)
            `(defn ,(concat name '/ field) (data) (dict/get data ,(atom field))))))
          (set-fields (list/map fields (fn (field)
            `(defn ,(concat name '/ field '/set) (dict data) (dict/set dict ,(atom field) data)))))
          (rest (concat set-fields get-fields)))
         (cons 'block (cons mk rest))))