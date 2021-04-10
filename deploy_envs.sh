#!/bin/bash

for dom in $(./enumerate_envs.py); do
  ns=$(echo $dom | awk -F- '{print $1}')
  cluster=$(echo $dom | awk -F- '{print $2}'); 
  echo "NS: $ns, Cluster $cluster"
  aws eks update-kubeconfig --name $cluster
  ./undeploy-eks.py -n $ns
  ./deploy-eks.py -n $ns
done
