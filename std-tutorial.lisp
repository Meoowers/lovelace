; No tutorial da biblioteca padrão (std), primeiro precisamos importá-la.
(require "./src/std.lisp")

; Para criar uma lista, usamos a função list.
(print (list 1 2 3))

; A biblioteca padrão (std) possui várias funções úteis para listas, como map,
; que aplica uma função a cada elemento de uma lista e retorna uma nova lista.
(print (list/map (list 1 2 3) (fn (x) (+ x 10))))

; Podemos usar o operador quote para tratar o código como uma lista literal.
(print '(print 1 2 3 ,variavel))

; O quasi-quote (`) permite interpolar variáveis dentro de estruturas.
; Aqui, usamos uma variável global para demonstrar.
(set* variavel 1000) ; Define a variável global 'variavel' com o valor 1000.
(print `(print 1 2 3 4 ,variavel 5)) ; Imprime a estrutura interpolada.

; O `defm` é usado para criar macros personalizadas de forma simples.

; Exemplo 1: Criando uma macro para somar dois números
(defm somar (a b)
    `(+ ,a ,b)) ; Constrói um template que soma os argumentos.

(print (somar (+ 10 20) 20)) ; Saída: 30.

; Exemplo 2: Criando uma macro para construir um par de valores
(defm par (x y)
    `(list ,x ,y)) ; Retorna uma lista com os dois valores.

(print (par "chave" "valor")) ; Saída: ("chave" "valor").

; ## Definindo Funções com `defn`
; O `defn` é uma forma prática de definir funções.

; Exemplo 1: Definindo uma função que dobra um número
(defn dobrar (x)
    (* x 2)) ; Corpo da função.

(print (dobrar 5)) ; Saída: 10.

; Exemplo 2: Definindo uma função para filtrar números pares
(defn apenas-pares (lista)
    (list/filter lista (fn (x) (= 0 (% x 2))))) ; Filtra os pares.

(print (apenas-pares (list 1 2 3 4 5 6))) ; Saída: (2 4 6).

; A macro `test` verifica se o resultado de uma expressão é igual ao esperado.
; Se der errado, ela imprime uma mensagem explicando o problema. 

; Exemplo 1: Testando uma função que soma dois números
(defn soma (a b)
    (+ a b)) ; Define a função soma.

(test "soma de 2 + 3" (soma 2 3) 5)

; define funções simples pra testar
(defn soma1 (x) (+ x 1))
(defn vezes2 (x) (* x 2))

; usando |> pra encadear
(print (|> 10 vezes2 soma1 vezes2 soma1))
(print (<| vezes2 soma1 vezes2 soma1 10))

; define funções simples
(defn sub1 (x) (- x 1))
(defn metade (x) (/ x 2))

; usando <| pra compor
(print (<| metade sub1 10)) ; começa subtraindo 1 (10 - 1) e depois divide por 2. saída: 4.

; define uma função pra somar 3 números
(defn soma3 (a b c) (+ a b c))

; fixa o primeiro argumento (parcial)
(set* soma-parcial (partial soma3 10))

; agora só precisamos passar os dois últimos argumentos
(print (soma-parcial 20 30)) ; saída: 60.

; agora só precisamos passar os dois últimos argumentos
(print (soma-parcial 0 0)) ; saída: 10.

; Cria um registro chamado `Pessoa` com dois campos: `nome` e `idade`
(def-record pessoa
    nome  ; campo para armazenar o nome da pessoa
    idade ; campo para armazenar a idade da pessoa
)

; Aqui estamos criando uma nova instância do registro `Pessoa` com valores específicos:
; - O nome será "Sofia"
; - A idade será 22
(set* sofia (pessoa/mk "Sofia" 22))

; Modificando o campo `nome` da instância `sofia` para um novo valor
(pessoa/nome/set sofia "Sooofiaaa")

; Exibindo a instância `sofia` para verificar os valores atualizados (o nome foi alterado)
(print sofia)

; Aqui estamos acessando e imprimindo o campo `nome` da instância `sofia`
(print (pessoa/nome sofia)) ; Saída esperada: "Sofia".

; Agora, acessamos o campo `idade` da instância `sofia` e imprimimos
(print (pessoa/idade sofia)) ; Saída esperada: 22.

; O `when` executa um bloco de código se a condição for verdadeira.
; Funciona como um `if`, mas é mais direto, sem necessidade de um `else`.
(when (= 2 (+ 1 1))
    (print "oi") ; será impresso "oi" porque 2 == 2
    (print "essa condição é verdadeira!")) ; e "essa condição é verdadeira!"

; O `unless` é o oposto do `when`. Ele executa o bloco de código apenas se a condição for falsa.
(unless (= 3 (+ 1 1))
    (print "essa condição é falsa!")) ; Será impresso "essa condição é falsa!" porque 3 != 2

; O `switch` permite verificar um valor contra várias opções (casos).
; Ele funciona como uma seleção de várias condições possíveis.
(switch 2
    (1 (print "é 1"))   ; Se o valor for 1, imprime "é 1"
    (2 (print "é 2"))   ; Se o valor for 2, imprime "é 2"
    (3 (print "é 3")))  ; Se o valor for 3, imprime "é 3"
; Neste caso, a condição 2 é verdadeira, então "é 2" será impresso.

; O `cond` permite testar várias condições em sequência.
; Cada condição tem uma ação associada. A primeira condição verdadeira é executada.
(cond
    ((= 1 2) (print "isso nunca será executado")) ; Esta condição é falsa, então é ignorada
    ((= 2 2) (print "essa condição é verdadeira")) ; Esta condição é verdadeira, então "essa condição é verdadeira" será impresso
    (:else   (print "isso é executado se nenhuma condição for verdadeira"))) ; Não será executado, pois já encontramos uma condição verdadeira.
; A saída será: "essa condição é verdadeira"

; O `case` é um mecanismo mais poderoso que permite fazer "pattern matching".
; Ele verifica tanto o valor quanto a estrutura de um dado.
(case '("foo" 42 3 4)
    (("foo" 42 ,x ,y) (print "caso 1: combina exatamente!" (+ x y))) ; Se a estrutura for igual a ("foo" 42 ,x ,y), a ação será executada e `x + y` será calculado.
    (("bar" &rest)    (print "caso 2: começa com 'bar'"))) ; Se começar com "bar", mas com qualquer número de outros elementos, a segunda ação será executada.

; A saída do exemplo será: "caso 1: combina exatamente!" seguido de "42", que é o valor de `x + y`.
