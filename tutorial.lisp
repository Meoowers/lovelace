; Os primitivos dessa linguagem são:

; O let que precisa de 2 argumentos, 1 é uma lista de bindings
; e o outro é o corpo do let.
(let ((x 10)
      (y 20))
(print (+ x y)))

; Set que serve para setar variaveis locais
(let ((x 10)
      (y 20))
(set y 200)
(print (+ x y)))

; Block para varios statements no mesmo lugar.
(block
    (print 1)
    (print 2)
    (print 3))

; Para setar no ambient globals set*
(set* t 100)

; Para lambdas a gente usa o `fn`, o argumento `f` do `fn` serve
; para dar um nome para o call trace da função anonima.

(set* f (fn f (x) (+ x 10)))

; If
(if (< t 10)
    (print 10)
    (print 20))

; While loop
(set* x 0)
(while (< x 10)
    (print x)
    (set* x (+ x 1)))

; Como usar macros.

(print "---------")

; A funcao mais util de todas por enquanto é o map.
(set* map (fn map (list func)
    (block
        (check list "list")
        (check func "closure")
        (if (cons? list)
            (cons (func (head list)) (map (tail list) func))
            ()))))

; Macro for quoting a list, allowing quasi-quoting (templates).
(set* quasi-quote (fn quasi-quote (expr)
    (if (cons? expr)
        (if (= 'unquote (head expr))
            (head (tail expr))
            (cons 'list (map expr quasi-quote)))
        (list 'quote expr))))

(macro quasi-quote)

; Facilidade

(set* variadic (fn variadic (a b &c)
    (block
        (print a)
        (print b)
        (print c))))

(set* defm (fn defm (name args &body)
    `(block
        (set* ,name (fn ,name ,args ,(cons `block body)))
        (macro ,name))))

(macro defm)

(print (expand `(defm defn (name args &body)
    `(set* ,name (fn ,name ,args ,(cons 'block body))))))

; Definindo meu fibbonaci

