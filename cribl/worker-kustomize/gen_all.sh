helm template cribl-w0 -f ./logs-wg.values.yml cribl/logstream-workergroup > all.yaml
helm template cribl-w1 -f ./metrics-wg.values.yml cribl/logstream-workergroup >> all.yaml
helm template cribl-w2 -f ./aws-wg.values.yml cribl/logstream-workergroup >> all.yaml
kustomize build > ../worker/cribl-worker-rendered.in.yml
