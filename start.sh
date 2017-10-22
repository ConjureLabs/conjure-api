#! /bin/bash

BASE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";

NODE_ENV="production" PORT=2999 CONJURE_PROFILE_PATH="$BASE/.profile" yarn start;
