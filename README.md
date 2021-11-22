
**This demo environment now runs only on Kubernetes**. 

To make use of this repo, you'll need to clone it locally - if you don't know how to do that, see the Github [Cloning a repository](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) documentation. 

## Changes

To see what's changed in the current version, see [CHANGES.md](CHANGES.md)

## Running Locally

To run this locally, we recommend minikube. Additionally, this environment uses `skaffold` to orchestrate building the requisite containers and deploying into Kubernetes, and `kustomize` to enable local deployment options. 

_**NOTE**_ - with this version of the repository, we need to use a version of skaffold that's v1.24.0 or greater - the instructions below have been changed to reflect that.  

## Pre-Requisites

### On a Mac with homebrew ([Homebrew Installation Instructions](https://docs.brew.sh/Installation))

```
brew install minikube
brew install kubectl
brew install helm
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-darwin-amd64 && \
chmod +x skaffold && sudo mv skaffold /usr/local/bin
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh"  | bash
sudo mv kustomize /usr/local/bin

```

### On a Mac with MacPorts ([MacPorts Installation Instructions](https://www.macports.org/install.php))
```
sudo port install minikube kubectl-1.20 helm-3.5
sudo port select --set helm helm3.5
sudo port select --set kubectl kubectl1.20
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-darwin-amd64 && \
chmod +x skaffold && sudo mv skaffold /usr/local/bin
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh"  | bash
sudo mv kustomize /usr/local/bin
```

If you don't have homebrew or MacPorts, check out the following links for install instructions:

    * Minikube: https://minikube.sigs.k8s.io/docs/start/
    * Kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl-macos/
    * Skaffold: https://skaffold.dev/docs/install/
    * Helm: https://helm.sh/docs/intro/install/
    * Kustomize: https://kubectl.docs.kubernetes.io/installation/kustomize/binaries/


### On Linux:
```
     curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64 && \
     chmod +x skaffold && sudo mv skaffold /usr/local/bin

    curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl \
    && sudo install kubectl /usr/local/bin && rm kubectl

    curl https://baltocdn.com/helm/signing.asc | sudo apt-key add - && \
    sudo apt-get install apt-transport-https --yes && \
    echo "deb https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list && \
    sudo apt-get update && \
    sudo apt-get install helm

    curl https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash

    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add - && \
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable" && \
    sudo apt update && \
    sudo apt install docker-ce && \
    sudo usermod -aG docker ${USER}

    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64 \
    && sudo install minikube-linux-amd64 /usr/local/bin/minikube && rm minikube-linux-amd64
    curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh"  | bash
    sudo mv kustomize /usr/local/bin
```

## Running Minikube locally

minikube can easily be run just by typing:

```
minikube start
```

While we've tested on minikube with default options, and we get a working demo environment, we recommend allocating 3-4 cpus and 8192MB of RAM. This repo has been tested both with the hyperkit driver:

```
minikube start --cpus=4 --memory=8192mb --vm-driver=hyperkit
```

as well as with the docker driver:

```
minikube start --cpus=4 --memory=8192mb --vm-driver=docker
```

minikube and skaffold don't always get along too well when it comes to image caching, so it's important to ensure that 
skaffold uses the docker environment within minikube. Luckily, this is pretty easy to do. Simple run:

```
eval $(minikube docker-env)
```

this will set a few environment variables that will instruct skaffold to use the minikube docker env, rather than the
systems docker env. 

## Running a Demo Environment


**_NOTE_**: This has changed - with the move to using configmaps instead of custom images, an additional setup has been added.

### Setup.sh 
The new step is the addition of a script called `setup.sh`, which sets up all of the ConfigMap and Secret objects that need to be in place. by default, it will set the objects up in the default namespace. The script supports the following options:
* `-n <namespace>` - kubernetes namespace to install in. This defaults to `default`
* `-p <password>` - admin password to set for the LogStream, Grafana, Splunk and InfluxDB instances. This defaults to `cribldemo`.
* `-b <branch>` - to set the branch for the ls-deploy job to run from. This only really necessary when testing changes in an alternate branch. This defaults to `master`
* `-a <authsecret>` - will update the default service account on the specified (or `default` if not specified) namespace to use the specified authsecret. This has no default.
* `-s` - enable AppScope in the resulting demo environment - AppScope needs to be installed on the cluster first (see [APPSCOPE.md](APPSCOPE.md) for details). 

**_NOTE_**: Dockerhub, as of November 2020, has implemented fairly restrictive rate limiting for anonymous access. If you see errors that refer to too many requests, you'll need to sign up for a free docker account, create an authsecret (see the kubernetes.io [doc](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#add-imagepullsecrets-to-a-service-account) for details on this), and use the -a option listed above to eliminate those errors. 

### Steps to Run

By default, the repo is set up to run on a fairly robust kubernetes cluster. To be able to run on a typical laptop, we needed to reduce the cpu/memory requirements. To do that, a combination of skaffold's profiles and kustomize are used to create options for a smaller footprint. 

The `-p dev` argument to skaffold invokes the "dev" profile, which minimizes the footprint of the deployment. If that's omitted, the services for cribl, splunk and grafana will all attempt to create load balancers and require significantly more horsepower from the hosting machine.


To run the demo LOCALLY on minikube (again, on a Mac):
```
    minikube start --cpus=4 --memory=8192mb  # Starts Minikube
    ./scripts/setup.sh                       # Sets up Configmaps
    skaffold dev --port-forward=true -p dev  # Starts the demo environment
```

Now, you can access Cribl at http://localhost:9000 with username `admin` password `cribldemo` (or the password you specified with the setup -p option). 

### Oddities in Execution


## Accessing Services in the Demo environment

Using the port-forwarding capability in skaffold (as seen above), will yield 4 services that you can access:

|Service|URL|Purpose|
|-------|---|-------|
|cribl|[http://localhost:9000](http://localhost:9000)|The Cribl LogStream master UI|
|splunk|[http://localhost:8000](http://localhost:8000)|The Splunk UI|
|influxdb2|[http://localhost:8086](http://localhost:8086)|The InfluxDB UI|
|grafana|[http://localhost:4000](http://localhost:4000)|The Grafana UI|


## Profiles<a name=profiles></a>

We have alternate profiles in the skaffold.yaml file:

* dev - this reduced the memory load of the environment by eliminating the resource allocations for each pod. The user facing services (logstream master, splunk, grafan and influxdb2) all will run in NodePort mode. It will also remove the data creation jobs (gogen-datacollection-syslog and cribl-sa), and the AWS worker group (aka cribl-w2)
* minimal - this also reduces the memory load through eliminated resource allocations and removes the aws worker group (aka cribl-w2). It also removes influxdb, grafana and splunk. This can be useful when looking to prototype something only in logstream. Beware when running in this profile, since incoming data will cause back pressure on the sources.
* nogen - this also reduces the memory load through eliminated resource allocations and removes the aws worker group (aka cribl-w2), and removes all of the gogen data generators from the deployed environment. 
* forward - this profile can be combined with any of the other profiles to forward the user facing services to 0.0.0.0 (instead of the default 127.0.0.1), allowing for access to it from other systems - useful when you're developing on an AWS EC2 instance with no GUI. 


## EKS Deployment

At Cribl, we run our standard demo environments on an AWS EKS cluster. If you would like to deploy this on EKS, see the [EKS-DEPLOY.md](EKS-DEPLOY.md) file. 

## Contributing to the cribl-demo project

If you want to contribute to the repo, see the [CONTRIBUTING.md](CONTRIBUTING.md) file.

# Reference Material

* [Minikube Tutorial](https://kubernetes.io/docs/tutorials/hello-minikube/) on kubernetes.io
* [Minikube Github Project](https://github.com/kubernetes/minikube)
