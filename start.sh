#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${DIR}

[ $? -gt 0 ] && gagaminikube start --cpus=4

source ${DIR}/mutating-webhook/scripts/install.sh
# cd ${DIR} && exec skaffold dev --port-forward=true
