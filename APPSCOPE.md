# Enabling AppScope

The demo environment has been modified to enable AppScope use to track the metrics and events from the demo environment pods. 

## What's There

* Source: `in_appscope` in the AWS worker group.
* Route: `appscope` in the AWS worker group.
* Pack: `appscope-processing`, including an `appscope_processing` pipeline.
* Output Router: `AppScope`, which sends metrics to the InfluxDB instance, and events to the Splunk instance.
* Dashboard: `AppScope` in the InfluxDB instance.

## How to Enable it

This needs to be executed *before* the cribl-demo is deployed. AppScope has k8s installation built into it, so the easiest way to install it in a namespace is running the following commands:
```
docker run  cribl/scope:0.6.1 scope k8s --cribldest cribl-w2:10090 --namespace <namespace> | kubectl apply -k
```
This will install the mutating admission webhook, as well as a configmap that the pods will use.

Then you need to enable the namespace itself for scope:
```
kubectl label namespace <namespace> scope=enabled
```