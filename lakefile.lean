import Lake
open Lake DSL

package lovelace where
  -- add package configuration options here

lean_lib Lovelace where
  -- add library configuration options here

@[default_target]
lean_exe «lovelace» where
  root := `Main
