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

; Exemplo de uso de `cons` para adicionar um elemento ao início de uma lista
(cons 1 (list 2 3 4)) ; Resultado: (1 2 3 4)

; Exemplo de uso de `push` para adicionar um elemento ao final de uma lista
(push 5 (list 1 2 3 4)) ; Resultado: (1 2 3 4 5)

; Exemplo de uso de `head` para obter o primeiro elemento de uma lista
(head (list 1 2 3 4)) ; Resultado: 1

; Exemplo de uso de `tail` para obter a lista sem o primeiro elemento
(tail (list 1 2 3 4)) ; Resultado: (2 3 4)

; Exemplo de uso de `string` para converter um valor em uma string
(string 123) ; Resultado: "123"

; Exemplo de uso de `type` para obter o tipo de um valor
(type (list 1 2 3)) ; Resultado: "list"

; Exemplo de uso de `length` para obter o número de elementos em uma lista
(length (list 1 2 3 4)) ; Resultado: 4

; Exemplo de uso de `atom` para criar um átomo a partir de uma string
(atom "myatom") ; Resultado: myatom

; Exemplo de uso de `concat` para concatenar strings ou listas
(concat (list 1 2) (list 3 4)) ; Resultado: (1 2 3 4)
(concat "Hello " "World") ; Resultado: "Hello World"

; Exemplo de uso de `apply` para chamar uma função com uma lista de argumentos
(apply (fn (x y) (+ x y)) (list 3 4)) ; Resultado: 7

; Exemplo de uso de `eval` para avaliar uma expressão Lisp
(eval (list '+ 2 3)) ; Resultado: 5

; Exemplo de uso de `dict` para criar um dicionário a partir de pares chave-valor
(dict (atom 'key1') 1 (atom 'key2') 2) ; Resultado: {key1: 1, key2: 2}

; Exemplo de uso de `dict/get` para recuperar um valor de um dicionário
(dict/get (dict (atom 'key1') 1 (atom 'key2') 2) (atom 'key1')) ; Resultado: 1

; Exemplo de uso de `dict/set` para atualizar um valor em um dicionário
(dict/set (dict (atom 'key1') 1 (atom 'key2') 2) (atom 'key1') 10) ; Resultado: {key1: 10, key2: 2}

; Exemplo de uso de `dict/to-list` para converter um dicionário em uma lista de pares chave-valor
(dict/to-list (dict (atom 'key1') 1 (atom 'key2') 2)) ; Resultado: ((key1 1) (key2 2))

; Exemplo de uso de `dict/of-list` para converter uma lista de pares chave-valor em um dicionário
(dict/of-list (list (list (atom 'key1') 1) (list (atom 'key2') 2))) ; Resultado: {key1: 1, key2: 2}

; Exemplo de uso de `print` para exibir um valor no console
(print (list 1 2 3 4)) ; Console: 1 2 3 4

; Exemplo de uso de `eprint` para exibir um valor na saída de erro
(eprint "mensagem de erro") ; Console de erro: mensagem de erro

; Exemplo de uso de `exit` para terminar o programa
(exit 0) ; Termina o programa com código de saída 0

; Exemplo de uso de `unsafe-eval` para avaliar uma string como código
(print (unsafe-eval "() => mkNil()")) ; Resultado: 3

; Exemplo de uso de `require` para carregar um módulo ou arquivo
(require "./compiler/std.lisp") ; Carrega e executa o conteúdo de "module.lisp"

; Exemplo de uso de `span` para obter o intervalo de uma expressão
(span (list 1 2 3)) ; Resultado: (start end) ; Onde `start` e `end` são os valores do intervalo

; Exemplo de uso de `throw` para levantar um erro
(throw "Algo deu errado oh não" (span 1)) ; Levanta um LispRuntimeError com a mensagem "Algo deu errado"
; Usa a localização do 1 para definir o erro.
