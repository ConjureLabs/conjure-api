#! /bin/bash
# Called on `npm start`

BASE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
. $BASE/../functions.cfg;

set -e; # die on any error

export NODE_PATH=$(cd $APP_DIR; cd server; pwd);
export PORT=2999;

if [ ! $CONJURE_PROFILE_PATH = "" ]; then
  source "$CONJURE_PROFILE_PATH";
else
  source $APP_DIR/../conjure-core/.profile;
fi

set +e; # no longer die on any error

cd $APP_DIR;
node ./server/;
