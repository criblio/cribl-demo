helm template cribl -f ./master.values.prod.yml cribl/logstream-master > all.yaml
kustomize build > ../master/cribl-master-rendered.in.yml
