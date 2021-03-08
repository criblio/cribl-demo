#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${DIR}

[ "$1" = "local" ] && minikube start $*

if [ -f ./scope ]; then
  ./scope k8s --metricdest tcp://cribl-w1:8125 --metricformat statsd --eventdest tcp://cribl-w0:10070 | kubectl apply -f -
fi

# source ${DIR}/mutating-webhook/scripts/install.sh
# cd ${DIR} && exec skaffold dev --port-forward=true
