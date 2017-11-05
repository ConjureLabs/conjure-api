#! /bin/bash

BASE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
. $BASE/../functions.cfg;

set -e;

eslint $APP_DIR --quiet;
progress "Lint passed";

jscs $APP_DIR;
progress "Coding style passed";
