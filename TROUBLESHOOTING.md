# Troubleshooting cribl-demo deployment

## Minikube

### Insufficient cpu notices

* if you're trying to run on minikube without a profile, this is likely an error that will lead to
  failure. Instead, try running skaffold dev with the `-p dev` or `-p minimal` options to reduce the 
  cpu and memory requirements.

* if you're running with one of the profiles, and minikube does not have at least 2 cpus allocated for it, you'll need to recreate your minikube runtime. To do this:

  ```
  minikube stop
  minikube delete
  minikube start --cpus=2 --memory=8192mb
  ```
  
  you should be able to re-run your skaffold command line, and have it run successfully. 
  

* if you're running with one of the profiles AND minikube does have at least 2 cpus, this most likely is a warning, and the containers will schedule and run given a little wait time. 


### Influxdb "exceeded progress deadline"

This issue seems to appear sporadically when running on minikube. There are a few post-install jobs that need to run after influxdb is installed, and they require the influxdb2 service to be up and available. If the system is running low on resources, it can take some time for the influxdb2 service to get to the ready state, 


### Skaffold exits when a deployment fails, but doesn't clean up resources

This can be a bit painful. There are a few steps that can resolve this:

1. run `skaffold delete` - this, in theory, should clean up any resources left behind, but it is less than perfect, and often fails when trying to clean up a failed deployment.
1. manually delete every component via `kubectl`. This is really painful.

Preferred approach is to *always* use a unique namespace when you run `skaffold dev` or deploy on EKS. If, say, you did the following to run:

```
kubectl create namespace myspace
skaffold dev --port-forward=true -p dev -n myspace
```

all of the resources would be in an isolated namespace called `myspace`. This allows you to run a single command to get rid of any resources in that namespace:

```
kubectl delete all --all -n myspace
```

Be _*VERY*_ careful with this command, and ensure that you've included the `-n <namespace>` argument, otherwise you may delete resources in your cluster that you didn't intend to delete... 