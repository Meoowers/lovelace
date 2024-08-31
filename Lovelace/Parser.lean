import Lean.Data.Parsec
import Lovelace.Syntax

namespace Lovelace
open Lean Lean.Parsec


namespace Syntax

/--
Gets the String.Pos from the current state of the Parser
-/
def position : Parsec String.Pos :=
  λs => ParseResult.success s s.i

/--
Runs a parser and gets the location of the parsed stuff.
-/
def toSyntax (f : α → Span → Syntax) (parser : Parsec α) : Parsec Syntax := do
  let startPos ← position
  let result ← parser
  let endPos ← position
  return f result { startPos, endPos }

def isName (char : Char) : Bool :=
  char ≠ ' ' ∧ char ≠ '\n' ∧ char ≠ '\t' ∧ char ≠ '\r' ∧ char ≠ '"'
  ∧ char ≠ '(' ∧ char ≠ ')' ∧ char ≠ '.'
  ∧ char ≠ '`' ∧ char ≠ '\''

def isDigit (char : Char) : Bool :=
  char ≥ '0' ∧ char ≤ '9'

def parseNumber : Parsec Nat := do
  let str ← many1Chars (satisfy isDigit)
  return String.toNat! str

def parseString : Parsec String := do
  skipChar '"'
  let value ← manyChars (satisfy (· ≠ '"'))
  skipChar '"'
  return value

def parseName : Parsec String :=
  many1Chars (satisfy isName)

def parseComment : Parsec Unit := do
  skipChar '#'
  discard (manyChars (satisfy (· ≠ '\n')))
  ws

def parseIdentifier : Parsec Identifier := do
  discard (many parseComment)
  let startPos ← position
  let str ← many1Chars (satisfy isName)
  let endPos ← position
  ws
  return { name := str, pos := { startPos, endPos }}

mutual

partial def parseLiteral : Parsec Syntax :=
      toSyntax Syntax.number parseNumber
  <|> toSyntax Syntax.identifier parseName
  <|> toSyntax Syntax.string parseString
  <|> toSyntax (λtup => Syntax.list tup.1 tup.2) parseList

partial def parseExpr : Parsec Syntax := do
  discard (many parseComment)
  let result ← parseLiteral
  ws
  return result

partial def parseList : Parsec (Identifier × Array Syntax) := do
  skipChar '('
  ws
  let identifier ← parseIdentifier
  let values ← many parseExpr
  skipChar ')'
  return (identifier, values)

end

def parseProgram : Parsec (Array Syntax) := do
  let mut result := #[]
  ws

  while true do
    discard (many parseComment)
    let res ← Parsec.tryCatch (toSyntax (λtup => Syntax.list tup.1 tup.2) parseList) (pure ∘ some) (λ_ => pure none)
    ws

    if let some res := res then
      result := result.push res
    else
      break

  eof
  return result

/--
Parses a string into a `Syntax`.
-/
def parse (string : String) : Except String (Array Syntax) :=
  parseProgram.run string

end Syntax
end Lovelace
