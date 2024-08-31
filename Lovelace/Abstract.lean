import Lovelace.Parser

namespace Lovelace

/--
Binary operations.
-/
inductive Operator
  | equal
  | notEqual
  | add
  | subtract
  | multiply
  | divide
  | logicalAnd
  | logicalOr
  deriving Repr, Inhabited

mutual

/--
Binary expressions that can be compiled.
-/
inductive BinaryExpr
  | mk (operator : Operator) (lhs : Expr) (rhs : Expr)
  deriving Repr

/--
Expressions that can be compiled.
-/
inductive Expr
  | number (num : Nat) (pos : Span)
  | string (str : String) (pos : Span)
  | identifier (id : Identifier)

  | binary (expr : BinaryExpr) (pos : Span)
  | logicalNot (arg : Expr) (pos : Span)

  | fnFree (params : Array Identifier) (body : Expr) (pos : Span)
  | MkClosure (closure : Expr) (snd : Array Syntax) (pos : Span)

  | fn (params : Array Identifier) (body : Expr) (pos : Span)
  | defn (name : Identifier) (params : Array Identifier) (body : Array Expr) (pos : Span)
  | caseExpr (condition : Expr) (cases : Array (Expr × Expr)) (default : Expr) (pos : Span)
  | application (fnName : Identifier) (args : Array Expr) (pos : Span)
  | letExpr (bindings : Array (Identifier × Expr)) (body : Expr) (pos : Span)
  | quote (body : Syntax) (pos : Span)
  deriving Repr, Inhabited

end

open Lovelace


/--
The converter is a monad that stores a list in the state so we can index it and avoid using a bunch of
weird stuff to get new elements.
-/
abbrev Converter (β : Type) (α : Type) : Type := ExceptT (String × Span) (StateT (Array β × Nat) Id) α

instance [Inhabited α] : Inhabited (Converter β α) where
  default := StateT.pure Inhabited.default

instance : Monad (Converter β) := inferInstanceAs (Monad (ExceptT (String × Span) (StateT (Array β × Nat) Id)))

namespace Converter

/--
Attempts to run a converter and returns `some` result if successful, or `none` if it fails.
-/
def try? (conv : Converter β α) : Converter β (Option α) := do
  let state ← ExceptT.lift StateT.get   -- Get the current state
  match conv.run state with
  | ⟨.ok result, newState⟩ => ExceptT.lift (StateT.set newState); pure (some result)
  | ⟨.error e, newState⟩ => if newState.snd != state.snd then throw e else pure none

/--
Runs a converter with a new list of parameters.
-/
def withParams (arr : Array β) (conv : Converter β α) : Converter δ α :=
  let ⟨res, _⟩ := Id.run <| conv.run.run (arr, 0)
  match res with
  | .ok res => ExceptT.lift (StateT.pure res)
  | .error err => throw err

/--
Runs the parser in.
-/
def runIn (syn : β) (parser : Converter β α) : Converter ω α :=
  withParams #[syn] parser

/--
Fails the computation with an error message and a span.
-/
def fail (msg : String) (span : Span) : Converter β α :=
  StateT.lift (Except.error (msg, span))

/--
Gets the next element from the list.
If the state is empty or out of bounds, it fails with an error message.
-/
def next (name : String) (span : Span) : Converter β β := do
  let (arr, idx) ← ExceptT.lift StateT.get
  if h : idx < arr.size
    then pure (arr.get ⟨idx, h⟩)
    else fail s!"Expected a `{name}` but got end of list." span  -- Adjust span as needed

/--
Gets the rest of the elements from the list starting at the current index.
If the state is empty or out of bounds, it returns an empty array.
-/
def many (name : String) (span : Span) : Converter β (Array β) := do
  let (arr, idx) ← ExceptT.lift StateT.get
  if idx < arr.size then
    let remaining := arr.extract idx arr.size
    -- Update the state to move the index to the end
    ExceptT.lift <| StateT.set (arr, arr.size)
    pure remaining
  else
    fail s!"Expected a `{name}` but got end of list." span

/--
Repeatedly applies a given converter to collect an array of results.
Stops when the converter fails.
-/
def manyIf (conv : Converter β α) : Converter β (Array α) := do
  let mut results := Array.empty
  let mut cont := true

  while cont do
    match ← (try? conv) with
    | some res => results := results.push res
    | none => cont := false

  pure results

/--
Gets the number variant from Syntax
-/
def getNumber (span : Span) : Converter Syntax Syntax.Num := do
  match (← next "number" span) with
  | .number num span => pure (num, span)
  | syn => fail "Expected a number" syn.span

/--
Gets the string variant from Syntax
-/
def getString (span : Span) : Converter Syntax Syntax.Str := do
  match (← next "string" span) with
  | .string str span => pure (str, span)
  | syn => fail "Expected a string" syn.span

/--
Gets the identifier variant from Syntax
-/
def getIdentifier (span : Span) : Converter Syntax Syntax.Id := do
  match (← next "identifier" span) with
  | .identifier name span => pure (name, span)
  | syn => fail "Expected an identifier" syn.span

/--
Gets the list variant from Syntax
-/
def getList (span : Span) : Converter Syntax Syntax.List := do
  match (← next "list" span) with
  | .list first list span => pure (first, list, span)
  | syn => fail "Expected a list" syn.span

/--
Gets the quote variant from Syntax
-/
def getQuote (span : Span) : Converter Syntax Syntax.Quote := do
  match (← next "quote" span) with
  | .quote arg span => pure (arg, span)
  | syn => fail "Expected a quote" syn.span

/--
Checks if the state is empty (i.e., if the index is past the end of the list).
-/
def isEmpty : Converter β Bool := do
  let (arr, idx) ← ExceptT.lift StateT.get
  pure (idx >= arr.size)

def convertIdentifier (pos : Span) : Converter Syntax Identifier := do
  let ⟨x, y⟩ ← getIdentifier pos
  return ⟨x, y⟩

mutual

partial def convertParams (pos : Span) : Converter Syntax (Array Identifier) := do
  let res ← manyIf (getIdentifier pos)
  return res.map (λ⟨x,y⟩ => ⟨x,y⟩)

/--
Converts a binary operation from a list of expressions.
-/
partial def convertBinaryOperation (op : Operator) (list : Array Syntax) (pos : Span) : Converter Syntax Expr := do
  let lhs ← convertExpr pos
  let rhs ← convertExpr pos
  let rest ← manyIf (convertExpr pos)
  let combined := rest.foldl (λ acc expr => Expr.binary (BinaryExpr.mk op acc expr) pos) rhs
  return Expr.binary (BinaryExpr.mk op lhs rhs) pos

partial def convertDefn (list : Array Syntax) (pos : Span) : Converter Syntax Expr := do
  let name ← convertIdentifier pos
  let params ← convertParams pos
  let body ← manyIf (convertExpr pos)
  return Expr.defn name params body pos

partial def convertFn (list : Array Syntax) (pos : Span) : Converter Syntax Expr := do
  let params ← convertParams pos
  let body ← convertExpr pos
  return Expr.fn params body pos

partial def convertList (first : Identifier) (list : Array Syntax) (pos : Span) : Converter Syntax Expr := do
  match first.name with
  | "defn" => convertDefn list pos
  | "fn" =>
    let params ← convertParams pos
    let body ← convertExpr pos
    return Expr.fn params body pos
  | _ => sorry

partial def convertExpr (span : Span) : Converter Syntax Expr := do
  match (← next "element" span) with
  | .quote s r => return Expr.quote s r
  | .number s r => return Expr.number s r
  | .string s r => return Expr.string s r
  | .identifier s r => return Expr.identifier (Identifier.mk s r)
  | .list f s r => convertList f s r

end
