#!/bin/bash

# Script to show test timing with hierarchical indentation
# Usage: 
#   ./scripts/test-timing.sh [test-output-file]
#   npm run test:timing
#   npm test | ./scripts/test-timing.sh

INPUT_FILE="${1:-}"

if [ -z "$INPUT_FILE" ]; then
  # If no file provided, read from stdin
  INPUT_FILE="/dev/stdin"
fi

awk '
/ok [0-9]+ -/ || /# Subtest:/ {
  original=$0
  test=$0
  indent=0
  while (match(test, /^ /)) {
    sub(/^ /, "", test)
    indent++
  }
  gsub(/^[ ]*ok [0-9]+ - /, "", original)
  gsub(/^[ ]*# Subtest: /, "", original)
  testname=original
  level=int(indent/4)
}
/^# duration_ms / {
  gsub(/^# duration_ms /, "", $0)
  total_duration=$0
}
/duration_ms:/ {
  if (testname) {
    gsub(/.*duration_ms: /, "", $0)
    gsub(/[^0-9.].*/, "", $0)
    indent_str=""
    for(i=0; i<level; i++) indent_str=indent_str"  "
    printf "%s%.3fs - %s\n", indent_str, $0/1000, testname
    testname=""
  }
}
END {
  if (total_duration) {
    printf "\nTotal elapsed time: %.3fs\n", total_duration/1000
  }
}' "$INPUT_FILE"

