# Running on EKS

If you want to run the cribl-demo on EKS, this document covers that. It is cumulative with the pre-requisites listed in [README.md](README.md). Running in "Production" mode on an EKS cluster requires a few additional steps.

## Pre-Requisites for Deployment Scripts

You will need to have a working python3 installation along with a working pip (or pip3) install to be able to deploy to EKS.

```
pip install -r ./requirements.txt
```
additionally, you'll need to have active AWS credentials in the shell.


## Deploy-Eks
This script handles the deployment of the demo environment to EKS, and the steps to create Route53 entries for all user facing services, as well as creating and posting an index.html with links to those services.

![EKS Deployment Flow](img/deploy-eks-flow.svg)

Running in EKS requires that you push the docker images up into ECR. ECR's repository structure requires that you pre-create the repos for each image. The script `deploy-eks.py` will create the ECR repos and build and deploy to your EKS cluster. You will need to run pip on the requirements.txt file, like this:


### Running
You can run the `deploy-eks.py` script, as follows:

```
./deploy-eks.py -c <repo head> [-d <domain default:demo.cribl.io>] [-n <namespace default:default>] [-r <region default:us-west-2>] [-a <description default:Demo Environment>] [-p <profile>]
```

or if you're using V2 of the AWS CLI, invoke it as follows:
```
aws2-wrap --profile <AWS Profile> --exec "./deploy-eks.py -c <repo head> [-d <domain default:demo.cribl.io>] [-n <namespace default:default>] [-r <region default:us-west-2>] [-a <description default:Demo Environment>] [-p <profile>]"
```

## Undeploy-EKS
This script "undeploys" the deployment of the demo environment resources, the Route53 entries associated with it, and the index.html file for those services.

![EKS Deployment Flow](img/undeploy-eks-flow.svg)

This script is the comprehensive way to "undeploy" an environment deployed with deploy-eks.py - it will not only run skaffold delete, but will also remove the CNAME entries from the Route53 hosted zone (domain), and remove the index file from s3.

### Running

Options for `undeploy-eks.py` are a subset of the options for `deploy-eks.py`

```
./undeploy-eks.py -c <repo head> [-d <domain default:demo.cribl.io>] [-n <namespace default:default>] [-r <region default:us-west-2>]
```

or if you're using V2 of the AWS CLI, invoke it as follows:
```
aws2-wrap --profile <AWS Profile> --exec "./undeploy-eks.py -c <repo head> [-d <domain default:demo.cribl.io>] [-n <namespace default:default>] [-r <region default:us-west-2>]"
```

## Arguments
* -c \<repo head\> - the name to use as the "directory" in the ECR repo structure - each image will end up as \<repo head\>/\<image name\>:\<tag\>
* -d \<domain\> - the domain to use - this will be looked up in Route53 - it defaults to demo.cribl.io. The domain must be a domain that is manageable from the account this is being run in. This will also be used in reverse notation (i.e. demo.cribl.io becomes io.cribl.demo) for the bucket name to upload the index files to.
* -n \<namespace\> - the k8s namespace that it should be deployed into. This defaults to "default", but it's recommended to use a separate namespace for each environment.
* -r \<region\> - the AWS region to deploy into.
* -a \<description\> - the description of the environment for the index page that gets generated. This can be html format (only available in `deploy-eks.py`).
-p \<profile\> - the skaffold profile to use (only available in `deploy-eks.py`)
