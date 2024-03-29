#!/bin/bash

SCRIPT_DIR=$(dirname $BASH_SOURCE[0])
DIR="$((cd -P "$SCRIPT_DIR/..") ; pwd)"

arg=$1
if [ -z "$arg" ]; then
  echo "Usage: $0 <job tag>"
  exit 254
fi

mv $SCRIPT_DIR/enumerate_envs.py $DIR

for dom in $($DIR/enumerate_envs.py -j $arg); do 
  
  # Remove kubeconfig
  #if [ -e ${HOME}/.kube/config ]; then 
   # rm ${HOME}/.kube/config
  #fi
  ns=$(echo $dom | awk -F- '{print $1}')
  cluster=$(echo $dom | awk -F- '{print $2}'); 
  branch=$(echo $dom | awk -F- '{print $3}'); 
  echo "NS: $ns, Cluster $cluster"
  aws eks update-kubeconfig --name $cluster
  kubectl config current-context
  git checkout $branch
  $DIR/scripts/setup.sh -n $ns
  $DIR/undeploy-eks.py -n $ns
  skaffold delete -n $ns
  sleep 300
  $DIR/deploy-eks.py -n $ns
done
