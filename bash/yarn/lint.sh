#! /bin/bash

BASE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
. $BASE/../functions.cfg;

if ! hash jscs 2>/dev/null; then
  error "Could not run jscs - you may need to run 'npm install jscs -g'";
  exit 1;
fi

if ! hash eslint 2>/dev/null; then
  error "Could not run eslint - you may need to run 'npm install eslint -g'";
  exit 1;
fi

BABEL_LINT=$(npm list -g | grep babel-eslint | wc -l);

if [ $BABEL_LINT -eq 0 ]; then
  error "eslint is installed, but babel support is not - you may need to run 'npm install babel-eslint -g'";
  exit 1;
fi

set -e;

eslint ./**/*.js;
jscs ./**/*.js;

progress "Lint passed";
