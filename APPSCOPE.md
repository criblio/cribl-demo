# Enabling AppScope

The demo environment has been modified to enable AppScope use to track the metrics and events from the demo environment pods. 

## What's There

* Source: `in_appscope` in the AWS worker group.
* Route: `appscope` in the AWS worker group.
* Pack: `appscope-processing`, including an `appscope_processing` pipeline.
* Output Router: `AppScope`, which sends metrics to the InfluxDB instance, and events to the Splunk instance.
* Dashboard: `AppScope` in the InfluxDB instance.

## How to Enable it

This needs to be executed *before* the cribl-demo is deployed. AppScope needs to be installed in the cluster first. AppScope has a built in kubernetes installation command:

```
docker run  cribl/scope:latest scope k8s --cribldest cribl-w2:10090 | kubectl apply -k
```

This will install the mutating admission webhook, and a general config. Now, each namespace that should be "scoped", needs to be enabled for it. The setup.sh script, if you give it a `-s` option, will enable the demo namespace for AppScope use. 