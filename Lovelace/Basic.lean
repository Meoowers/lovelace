import Lovelace.Parser

structure Identifier where
  name : String
  pos  : Span
  deriving Repr

inductive Expression
  | number (num : Nat) (pos : Span)
  | string (str : String) (pos : Span)
  | identifier (id : Identifier)
  | listExpr (list : Array Expression) (pos : Span)

  | equal (lhs : Expression) (rhs : Expression) (pos : Span)
  | notEqual (lhs : Expression) (rhs : Expression) (pos : Span)
  | add (lhs : Expression) (rhs : Expression) (pos : Span)
  | subtract (lhs : Expression) (rhs : Expression) (pos : Span)
  | multiply (lhs : Expression) (rhs : Expression) (pos : Span)
  | divide (lhs : Expression) (rhs : Expression) (pos : Span)
  | logicalAnd (lhs : Expression) (rhs : Expression) (pos : Span)
  | logicalOr (lhs : Expression) (rhs : Expression) (pos : Span)
  | logicalNot (arg : Expression) (pos : Span)

  | fn (params : Array Identifier) (body : Expression) (pos : Span)
  | defn (name : Identifier) (params : Array Identifier) (body : Expression) (pos : Span)
  | caseExpr (condition : Expression) (cases : Array (Expression × Expression)) (default : Expression) (pos : Span)
  | application (fnName : Identifier) (args : Array Expression) (pos : Span)
  | letExpr (bindings : Array (Identifier × Expression)) (body : Expression) (pos : Span)
  deriving Repr
