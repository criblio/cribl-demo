This demo environment uses Kubernetes. To run this locally, we recommend minikube. Additionally, this environment uses `skaffold` to orchestrate building the requisite containers and deploying into Kubernetes. On a Mac with homebrew:

    brew install minikube
    brew install skaffold
    brew install kubectl
    brew install helm

On Linux:

    curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64 && \
    sudo install skaffold /usr/local/bin/ && \
    rm ./skaffold

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


If you don't have homebrew, check out the following links for install instructions:
    * Minikube: https://minikube.sigs.k8s.io/docs/start/
    * Skaffold: https://skaffold.dev/docs/install/

To run the demo (again, on a Mac):

    ./start.sh
    skaffold dev --port-forward=true

Now, you can access Cribl at http://localhost:9000 with username `admin` password `cribldemo`. 

# Running on EKS
Running in "Production" mode on an EKS cluster requires a few additional steps.

## Setup ECR
Running in EKS requires that you push the docker images up into ECR. ECR's repository structure requires that you pre-create the repos for each image. The script "setup-ecr" can take care of that. You need to have an active AWS credential in the environment (or use aws2-wrap), as well as either AWS_DEFAULT_REGION or AWS_REGION set to your preferred region (otherwise, it will default to us-west-2). The command line is as follows:

```
./setup-ecr <repo head>
```

The \<repo head> argument creates the top level of the repository structure, so `./setup-ecr cribl-demo-main` will have the following output:

```
host% ./setup-ecr cribl-demo-main
Defaulting Region to us-west-2 - if you want a different region, set AWS_REGION or AWS_DEFAULT_REGION and rerun
Login Succeeded
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/apiserver
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-master
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-sa
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-worker
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-accesscombined-forwarder
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-authfailed-filebeat
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-bigjson-webhook
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-businessevent-hec
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-datacollection-syslog
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-metrics-dogstatsd
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-pantraffic-syslog
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-statechange-syslog
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/grafana
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/redis
Created: 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/splunk
Use the --default-repo 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main option to skaffold deploy
Or export SKAFFOLD_DEFAULT_REPO=536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main
```

## Build the Images
Now that the repo is setup, you'll need to build the images. You can either set the SKAFFOLD_DEFAULT_REPO environment variable, or provide the --default-repo argument to each command. To build the images, run the skaffold build command, with a --tag option that will define the tag we'll be deploying (next):

```
host% export SKAFFOLD_DEFAULT_REPO=536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main
host% skaffold build --tag=demo1
Generating tags...
 - apiserver -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/apiserver:demo1
 - cribl-master -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-master:demo1
 - cribl-worker -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-worker:demo1
 - cribl-sa -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-sa:demo1
 - gogen-bigjson-webhook -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-bigjson-webhook:demo1
 - gogen-businessevent-hec -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-businessevent-hec:demo1
 - gogen-metrics-dogstatsd -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-metrics-dogstatsd:demo1
 - gogen-pantraffic-syslog -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-pantraffic-syslog:demo1
 - gogen-statechange-syslog -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-statechange-syslog:demo1
 - gogen-accesscombined-forwarder -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-accesscombined-forwarder:demo1
 - gogen-authfailed-filebeat -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-authfailed-filebeat:demo1
 - gogen-datacollection-syslog -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-datacollection-syslog:demo1
 - grafana -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/grafana:demo1
 - redis -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/redis:demo1
 - splunk -> 536497934283.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/splunk:demo1

 ...
```

## Deploying the build
We'll use `skaffold deploy` to deploy the environment. By default, all services use the ClusterIP type, but we want the user facing services to instead use a LoadBalancer type. To acheive this, we use the Kustomize utility, and associate kustomizations to a profile. In this case, if we use the "prod" profile, those services will be deployed using the LoadBalancer type. In addition, we have to include the --tag option to specify the tag we want to deploy. Finally, to deploy in a namespace, specify -n \<namespace>. For example, to deploy the tag "demo1" to the "testing" namespace:

```
skaffold deploy --tag demo1 -p prod -n testing
Tags used in deployment:
 - apiserver -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/apiserver:demo1
 - cribl-master -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-master:demo1
 - cribl-worker -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-worker:demo1
 - cribl-sa -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/cribl-sa:demo1
 - gogen-bigjson-webhook -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-bigjson-webhook:demo1
 - gogen-businessevent-hec -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-businessevent-hec:demo1
 - gogen-metrics-dogstatsd -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-metrics-dogstatsd:demo1
 - gogen-pantraffic-syslog -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-pantraffic-syslog:demo1
 - gogen-statechange-syslog -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-statechange-syslog:demo1
 - gogen-accesscombined-forwarder -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-accesscombined-forwarder:demo1
 - gogen-authfailed-filebeat -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-authfailed-filebeat:demo1
 - gogen-datacollection-syslog -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/gogen-datacollection-syslog:demo1
 - grafana -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/grafana:demo1
 - redis -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/redis:demo1
 - splunk -> 586997984287.dkr.ecr.us-west-2.amazonaws.com/cribl-demo-main/splunk:demo1
Starting deploy...
```

