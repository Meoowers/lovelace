; Primitivos da linguagem:

; 1. `let`: O `let` serve para declarar variáveis locais. Ele aceita dois
; argumentos: o primeiro é uma lista de bindings (variáveis e seus valores),
; e o segundo é o corpo do `let`, onde você pode usar as variáveis definidas.

; Exemplo:
(let ((x 10)  ; x é definido como 10
      (y 20)) ; y é definido como 20
  (print (+ x y)))  ; Soma x e y, e imprime o resultado (30)

; 2. `set`: Usado para atualizar variáveis locais dentro do escopo atual.
; Aqui, modificamos o valor de `y` após a sua definição.

; Exemplo:
(let ((x 10)   ; Definimos x como 10
      (y 20))  ; Definimos y como 20
  (set y 200)  ; Atualizamos y para 200
  (print (+ x y)))  ; Soma x e y, e imprime o resultado (210)

; 3. `block`: Permite agrupar múltiplos statements, onde o último valor do
; bloco é retornado. Útil para sequenciar operações.

; Exemplo:
(block
    (print 1)  ; Imprime 1
    (print 2)  ; Imprime 2
    (print 3)) ; Imprime 3
; O bloco acima imprime os três valores em sequência.

; 4. `set*`: Utilizado para definir variáveis globais que permanecem
; acessíveis em todo o programa. É uma forma de armazenar variáveis no
; "ambiente global".

; Exemplo:
(set* t 100)  ; Define a variável global `t` com o valor 100.

; 5. `fn`: Usado para definir funções anônimas (lambdas). O argumento `f`
; opcional serve como nome para a função dentro do call trace.

; Exemplo:
(set* f (fn f (x) (+ x 10)))  ; Define uma função que adiciona 10 ao argumento.
(print (f 5))  ; Aplica a função `f` a 5 e imprime o resultado (15).

; 6. `if`: Expressão condicional que aceita uma condição, um bloco para
; o caso verdadeiro, e um bloco para o caso falso.

; Exemplo:
(if (< t 10)            ; Se t for menor que 10...
    (print 10)          ; Imprime 10.
    (print 20))         ; Caso contrário, imprime 20.

; 7. `while`: Laço de repetição que continua executando enquanto a condição
; fornecida for verdadeira. Perfeito para loops baseados em condições.

; Exemplo:
(set* x 0)              ; Inicializa x com 0.
(while (< x 10)         ; Enquanto x for menor que 10...
    (print x)           ; Imprime x.
    (set* x (+ x 1)))   ; Incrementa x em 1.

; 8. Funções úteis: O `map` aplica uma função `func` a cada elemento de uma
; lista e retorna uma nova lista com os resultados.

; Exemplo:
(set* map (fn map (list func)
    (block
        (check list "list")
        (check func "closure")
        (if (cons? list)
            (cons (func (head list)) (map (tail list) func))
            ()))))

(map '(1 2 3) (fn f (x) (* x 2)))  ; Retorna: (2 4 6)

; 9. Usando macros: Macros são como funções, mas são expandidos em tempo de
; compilação. Aqui temos o `quasi-quote`, que permite citar listas e
; incluir elementos não citados.

; Exemplo:
(set* quasi-quote (fn quasi-quote (expr)
    (if (cons? expr)
        (if (= 'unquote (head expr))
            (head (tail expr))
            (cons 'list (map expr quasi-quote)))
        (list 'quote expr))))

(macro quasi-quote)

; Uso da macro `quasi-quote` para citar uma lista:
(print `(a b ,(+ 1 2)))  ; Gera: (list 'a 'b 3)

; 10. Funções variádicas: Aceitam um número indefinido de argumentos. Aqui,
; `a` e `b` são obrigatórios, enquanto `&c` captura todos os argumentos extras.

; Exemplo:
(set* variadic (fn variadic (a b &c)
    (block
        (print a)  ; Imprime o primeiro argumento
        (print b)  ; Imprime o segundo argumento
        (print c))))  ; Imprime os argumentos extras como uma lista

(variadic 1 2 3 4 5)  ; Imprime: 1, 2, (3 4 5)

; 11. Definindo macros: Usamos a macro `defm` para criar macros facilmente.
; Aqui, criamos um exemplo que define a macro `defn` para definir funções.

; Exemplo:
(set* defm (fn defm (name args &body)
    `(block
        (set* ,name (fn ,name ,args ,(cons `block body)))
        (macro ,name))))

(macro defm)

; Definindo uma macro `defn` para criar funções:
(defm defn (name args &body)
    `(set* ,name (fn ,name ,args ,(cons 'block body))))

; Exemplo de uso da macro `defn`:
(defn minha-funcao (x y)
    (print (+ x y)))

(minha-funcao 3 4)  ; Resultado: 7

; 12. Variáveis e primitivas de lista: Aqui temos a criação de uma lista
; e uso de funções como `nil?` e `cons?` para verificar se a lista está vazia
; ou se é uma cons cell (lista encadeada).

; Exemplo:
(set* x (cons 3 (cons 2 (cons 1 ()))))  ; Cria uma lista encadeada.
(set* y (list 1 2 3))                   ; Cria uma lista escadeada, tambem.
(print (nil? x))                        ; Verifica se x é nulo (falso).
(print (cons? x))                       ; Verifica se x é uma cons cell (verdadeiro).
(print ())                              ; Imprime uma lista vazia.

; Funções de lista básicas:

; 1. `cons?`: Verifica se um dado valor é uma cons cell (lista encadeada).
; Exemplo de uso:
(print (cons? (cons 1 (cons 2 (cons 3 ()))))) ; Deve imprimir: true
(print (cons? (list 1 2 3)))                  ; Deve imprimir: true

; 2. `cons`: Cria uma cons cell, que é a base para a construção de listas encadeadas.
; Exemplo de uso:
(set* minha-lista (cons 1 (cons 2 (cons 3 ())))) ; Cria uma lista encadeada: (1 . (2 . (3 . ())))
(print minha-lista)                            ; Deve imprimir: (1 2 3)

; 3. `nil?`: Verifica se um dado valor é `nil`, que representa uma lista vazia ou ausência de valor.
; Exemplo de uso:
(print (nil? (cons 1 (cons 2 (cons 3 ()))))) ; Deve imprimir: false (porque não é nil, é uma cons cell)
(print (nil? (list)))                        ; Deve imprimir: true (porque é uma lista vazia)
(print (nil? (cons 1 (list))))               ; Deve imprimir: false (porque é uma cons cell com elementos)

; Exemplo combinado:

; Criando uma lista encadeada e verificando com `cons?` e `nil?`:
(set* lista1 (cons 4 (cons 5 (cons 6 ()))))  ; Cria uma lista encadeada: (4 (5 (6 ())))
(print (cons? lista1))                      ; Deve imprimir: true
(print (nil? lista1))                       ; Deve imprimir: false

; Criando uma lista vazia e verificando:
(set* lista2 (list))                        ; Cria uma lista vazia: ()
(print (cons? lista2))                     ; Deve imprimir: false (porque é uma lista vazia, não uma cons cell)
(print (nil? lista2))                      ; Deve imprimir: true

; Usando `cons` para construir e verificar listas:
(set* lista3 (cons 7 (list 8 9)))            ; Cria uma lista: (7 8 9)
(print (cons? lista3))                      ; Deve imprimir: true
(print (nil? (cons 7 (list 8 9))))          ; Deve imprimir: false

; Verificando se o `head` e `tail` são vazios:
(set* head-element (head lista3))           ; Obtém o primeiro elemento
(print head-element)                        ; Deve imprimir: 7
(print (nil? head-element))                 ; Deve imprimir: false

(set* tail-list (tail lista3))              ; Obtém o restante da lista
(print tail-list)                           ; Deve imprimir: (8 9)
(print (nil? tail-list))                    ; Deve imprimir: false

; Example usage of `cons` to add an element to the front of a list
(cons 1 (list 2 3 4)) ; Result: (1 2 3 4)

; Example usage of `push` to add an element to the end of a list
(push 5 (list 1 2 3 4)) ; Result: (1 2 3 4 5)

; Example usage of `head` to get the first element of a list
(head (list 1 2 3 4)) ; Result: 1

; Example usage of `tail` to get the list without the first element
(tail (list 1 2 3 4)) ; Result: (2 3 4)

; Example usage of `string` to convert a value to a string
(string 123) ; Result: "123"

; Example usage of `type` to get the type of a value
(type (list 1 2 3)) ; Result: "list"

; Example usage of `length` to get the number of elements in a list
(length (list 1 2 3 4)) ; Result: 4

; Example usage of `atom` to create an atom from a string
(atom "myatom") ; Result: myatom

; Example usage of `concat` to concatenate strings or lists
(concat (list 1 2) (list 3 4)) ; Result: (1 2 3 4)
(concat "Hello " "World") ; Result: "Hello World"

; Example usage of `apply` to call a function with a list of arguments
(apply (fn (x y) (+ x y)) (list 3 4)) ; Result: 7

; Example usage of `eval` to evaluate a Lisp expression
(eval (list '+ 2 3)) ; Result: 5

; Example usage of `dict` to create a dictionary from key-value pairs
(dict (atom 'key1') 1 (atom 'key2') 2) ; Result: {key1: 1, key2: 2}

; Example usage of `dict/get` to retrieve a value from a dictionary
(dict/get (dict (atom 'key1') 1 (atom 'key2') 2) (atom 'key1')) ; Result: 1

; Example usage of `dict/set` to update a value in a dictionary
(dict/set (dict (atom 'key1') 1 (atom 'key2') 2) (atom 'key1') 10) ; Result: {key1: 10, key2: 2}

; Example usage of `dict/to-list` to convert a dictionary to a list of key-value pairs
(dict/to-list (dict (atom 'key1') 1 (atom 'key2') 2)) ; Result: ((key1 1) (key2 2))

; Example usage of `dict/of-list` to convert a list of key-value pairs to a dictionary
(dict/of-list (list (list (atom 'key1') 1) (list (atom 'key2') 2))) ; Result: {key1: 1, key2: 2}

; Example usage of `print` to output a value to the console
(print (list 1 2 3 4)) ; Console: 1 2 3 4

; Example usage of `eprint` to output a value to the error stream
(eprint "error message") ; Console error: Error message

; Example usage of `exit` to terminate the program
; (exit 0) ; Terminates the program with exit code 0

; Example usage of `unsafe-eval` to evaluate a string as code
(print (unsafe-eval "() => mkNil()")) ; Result: 3

; Example usage of `require` to load a module or file
(require "./compiler/std.lisp") ; Loads and executes the contents of "module.lisp"

; Example usage of `span` to get the span of an expression
(span (list 1 2 3)) ; Result: (start end) ; Where `start` and `end` are the span values

; Example usage of `throw` to raise an error
(throw "Something went wrong oh no" (span 1)) ; Raises a LispRuntimeError with the message "Something went wrong"
; It uses the location of the 1 to set the error.