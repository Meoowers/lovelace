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

; Macro for quoting a list, allowing quasi-quoting (templates).
(set* quasi-quote (fn quasi-quote (expr)
    (if (cons? expr)
        (if (= 'unquote (head expr))
            (head (tail expr))
            (cons 'list (list/map expr quasi-quote)))
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

(defn todo! ()
    (print "todo!")
    (exit 1))