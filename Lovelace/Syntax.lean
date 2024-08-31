import Lean.Data.Parsec

namespace Lovelace
open Lean Lean.Parsec

/--
This type describes a position between two indices.
-/
structure Span where
  startPos : String.Pos
  endPos : String.Pos
  deriving Repr, Inhabited

structure Identifier where
  name : String
  pos : Span
  deriving Repr, Inhabited

/--
This type describes the syntax of a simple lisp.
-/
inductive Syntax
  | number (num : Nat) (pos : Span)
  | string (str : String) (pos : Span)
  | identifier (name : String) (pos : Span)
  | list (first : Identifier) (list : Array Syntax) (pos : Span)
  | quote (arg : Syntax) (pos : Span)
  deriving Repr, Inhabited

def Syntax.List : Type := Identifier × Array Syntax × Span

def Syntax.Num : Type := Nat × Span

def Syntax.Str : Type := String × Span

def Syntax.Id : Type := String × Span

def Syntax.Quote : Type := Syntax × Span

namespace Syntax

/--
Gets the span of a piece of syntax.
-/
def span (syn : Syntax) : Span :=
  match syn with
  | .number (pos := pos) .. => pos
  | .string (pos := pos) .. => pos
  | .identifier (pos := pos) .. => pos
  | .list (pos := pos) .. => pos
  | .quote (pos := pos) .. => pos

end Syntax
end Lovelace
