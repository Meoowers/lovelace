; List primitives

(require "./src/std/basic.lisp")

; Like `fold`, but applies `f` from the right side of the list.
(defn list/foldr (list acc f)
    (check f "closure")
    (check list "list")
    (if (cons? list)
        (f (list/foldr (tail list) acc f) (head list))
        acc))

; Returns the last element in a list.
(defn list/last (list)
    (check list "list")
    (if (cons? (tail list))
        (list/last (tail list))
        (head list)))

; Checks if a list `list` includes the element `el`.
(defn list/includes (list el)
    (check list "list")
    (if (cons? list)
        (if (= (head list) el)
            :true
            (list/includes (tail list) el))
        :false))

; Returns `true` if all elements of `list` match the predicate `pred`.
(defn list/all (list pred)
    (check pred "closure")
    (check list "list")
    (if (cons? list)
        (if (pred (head list))
            (list/all (tail list) pred)
            :false)
        :true))

(defn list/foreach (list f)
    (check f "closure")
    (check list "list")
    (if (cons? list)
        (block
            (f (head list))
            (list/foreach (tail list) f))
        list))

; Like `map`, but passes an index to the function `f`.
(defn list/mapi (list f index)
    (check f "closure")
    (check list "list")
    (if (cons? list)
        (cons (f (head list) index) (list/mapi (tail list) f (+ index 1)))
        list))

; Helper function to the list/reverse function
(defn list/reverse/inner (list acc)
    (if (cons? list)
        (list/reverse/inner (tail list) (cons (head list) acc))
        acc))

; Reverses the list
(defn list/reverse (list)
        (check list "list")
        (list/reverse/inner list ()))

(test "list/reverse" (list/reverse (list 1 2 3)) (list 3 2 1))

; Appends `list2` to `list1`, returning a combined list.
(defn list/append (list1 list2)
    (check list1 "list")
    (check list2 "list")
    (if (cons? list1)
        (cons (head list1) (list/append (tail list1) list2))
        list2))

; Appends `list2` to `list1`, returning a combined list.
(defn list/append (list1 list2)
    (check list1 "list")
    (check list2 "list")
    (if (cons? list1)
        (cons (head list1) (list/append (tail list1) list2))
        list2))

(test "list append" (list/append (list 1 2 3) (list 4 5)) (list 1 2 3 4 5))

(defn list/split/inner (list n)
    (check list "list")
    (if (if (cons? list) (> n 0) :false)
        (let ((l-head (head list)))
            (let ((split-rest (list/split/inner (tail list) (- n 1))))
                (cons (cons l-head (head split-rest)) (tail split-rest))))
        (cons () list)))

; Splits the list into two parts at the given index `n`.
; Returns a pair of lists, where the first contains the elements before `n`, and the second contains the rest.
(defn list/split (ls n)
    (let ((x (list/split/inner ls n)))
    (list (head x) (tail x))))