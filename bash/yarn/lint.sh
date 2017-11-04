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

set -e;

eslint ./**/*.js --quiet;
jscs ./**/*.js;

progress "Lint passed";
