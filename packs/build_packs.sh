#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

FIND=$(which gfind)
if [ -z "${FIND}" ]; then
    FIND=$(which find)
fi

for pack in $(${FIND} $DIR -maxdepth 1 -mindepth 1 -type d -printf "%f\n" | egrep -v "build"); do
  (cd $pack; tar czf ../build/$pack.crbl .)
done

