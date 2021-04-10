#!/bin/bash

SCRIPT_DIR=$(dirname $BASH_SOURCE[0])
DIR="$((cd -P "$SCRIPT_DIR/..") ; pwd)"

arg=$1
if [ -z "$arg" ]; then
  echo "Usage: $0 <job tag>"
  exit 254
fi

for dom in $($SCRIPT_DIR/enumerate_envs.py -j $arg); do 
  # Remove kubeconfig
  #if [ -e ${HOME}/.kube/config ]; then 
   # rm ${HOME}/.kube/config
  #fi
  ns=$(echo $dom | awk -F- '{print $1}')
  cluster=$(echo $dom | awk -F- '{print $2}'); 
  echo "NS: $ns, Cluster $cluster"
  aws eks update-kubeconfig --name $cluster
  $DIR/undeploy-eks.py -n $ns
  $DIR/deploy-eks.py -n $ns
done
