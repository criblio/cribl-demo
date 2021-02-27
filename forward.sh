#!/bin/bash
kubectl --context minikube port-forward --pod-running-timeout 1s --namespace default deployment/grafana 3000:3000 --address 0.0.0.0 &
kubectl --context minikube port-forward --pod-running-timeout 1s --namespace default deployment/cribl 9000:9000 --address 0.0.0.0 &
kubectl --context minikube port-forward --pod-running-timeout 1s --namespace default deployment/splunk 8000:8000 --address 0.0.0.0 &
wait
