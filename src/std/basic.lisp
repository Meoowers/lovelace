; This is the foundation of the LISP. Some functions from other modules should be defined here because
; We have an evaluation order.

(set* list/map (fn list/map (list f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (cons (f (head list)) (list/map (tail list) f))
            list))))

; Filters a list `list` based on a predicate `pred`.
(set* list/filter (fn list/filter (list pred)
    (block
        (check pred "closure")
        (check list "list")
        (if (cons? list)
            (if (pred (head list))
                (cons (head list) (list/filter (tail list) pred))
                (list/filter (tail list) pred))
            list))))

; Reduces `list` into a single value by accumulating with function `f`.
(set* list/fold (fn list/fold (list acc f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (list/fold (tail list) (f acc (head list)) f)
            acc))))

; Reduces `list` into a single value by accumulating with function `f`.
(set* list/foldr (fn list/foldr (list acc f)
    (block
        (check f "closure")
        (check list "list")
        (if (cons? list)
            (f (list/foldr (tail list) acc f) (head list))
            acc))))

; Checks if any item of the list satisfies the predicate.
(set* list/any (fn list/any (list pred)
    (block
        (check pred "closure")
        (check list "list")
        (if (cons? list)
            (if (pred (head list))
                :true
                (list/any (tail list) pred))
            :false))))

(set* quasi-quote/unsplice? (fn quasi-quote/unsplice? (list)
    (if (cons? list)
        (if (= (head list) 'unsplice-quote)
            :true
            ())
        ())))

(set* quasi-quote/contains-unsplice? (fn quasi-quote/contains-unsplice? (list)
    (list/any list quasi-quote/unsplice?)))

(set* quasi-quote/unsplicer-core (fn quasi-quote/unsplicer-core (ls)
    (let ((acc (list/foldr ls (list () ()) (fn (acc cur)
                    (if (quasi-quote/unsplice? cur)
                        (list () (concat (tail (quasi-quote (tail cur))) (at acc 0) (at acc 1)))
                        (list (cons (list 'list (quasi-quote cur)) (at acc 0)) (at acc 1))))))
          (final (concat (at acc 0) (at acc 1))))
    (cons 'concat final))))

(set* quasi-quote/unsplicer (fn quasi-quote/unsplicer (ls)
    (if (quasi-quote/contains-unsplice? ls)
        (quasi-quote/unsplicer-core ls)
        (cons 'list (list/map ls quasi-quote)))))

; Macro for quoting a list, allowing quasi-quoting (templates).
(set* quasi-quote (fn quasi-quote (expr)
    (if (cons? expr)
        (if (= 'unquote (head expr))
            (head (tail expr))
            (quasi-quote/unsplicer expr))
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

; Macro for unit testing
(defm test (name value expected)
    (let ((value (eval value))
          (expected (eval expected)))
    (if (!= value expected)
        (print (concat "❌\u001b[31m test `" name "` : expected: `" (string expected) "` but got `" (string value) "`\u001b[0m")))))

(defn todo! (&args)
    (eprint "todo!:" (apply concat (cons "" args)))
    (exit 1))

; Converiosn tests

(defn is? (value typ)
    (= (type value) typ))

(defn string? (value)
    (is? value "string"))

(defn identifier? (value)
    (is? value "identifier"))

(defn list? (value)
    (cons? value))