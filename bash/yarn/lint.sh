#! /bin/bash

BASE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
. $BASE/../functions.cfg;

set -e;

eslint ./**/*.js --quiet;
progress "Lint passed";

jscs ./**/*.js;
progress "Coding style passed";
