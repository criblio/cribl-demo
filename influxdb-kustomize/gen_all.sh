helm template influxdb2 -f ./prod-values.yaml -n testns influxdata/influxdb2 > all.yaml
kustomize build > influxdb2-rendered.yml
