# Contributing to cribl-demo



## Intro

The cribl-demo repo is managed in Github, and the repository is maintained by Steve Litras (steve@cribl.io). All contributions must be made via a git pull request.


We use a fairly typical feature branching approach to collaborative development. 

![Git Flow Diagram](img/git-flow.svg)

## Git Setup

### GitHub Access

In order to contribute, you’ll need a github.com ID - go to [https://github.com/](https://github.com/), click on “sign up”, and create an account. If you are a cribl employee, please use your cribl email address for the account. Once you’ve created your account, associate an SSH key with it. See the [github docs](https://docs.github.com/en/github/authenticating-to-github/adding-a-new-ssh-key-to-your-github-account) for details on doing that.

Once you’ve got an account set up, and an ssh key added to it, send [@Steve Litras](mailto:steve@cribl.io) a note to add you to the repository. You’ll be added with write access to the repo.

### Cloning to Local

Once you’ve got an account and an ssh key, you can clone the repo via ssh (you just won’t be able to do anything other than read until your account is enabled for the repo). If you already have the repo cloned via https, it's recommended to delete it and reclone using ssh. To do this, just run:
```
git clone git@github.com:criblio/cribl-demo.git
```

This will create a “cribl-demo” directory in your current working directory, and copy all of the contents of the repo to it.

### Creating a Feature Branch

Direct writing to the master branch should not be done (and in fact is disallowed by rule). Instead, you should create a branch, based off of the `main` branch.  There are a few ways to create a branch, but the easiest way is to go to the github repo’s page at:

[https://github.com/criblio/cribl-demo](https://github.com/criblio/cribl-demo)

Once there, ensure that the master branch is selected (see the below image).
![Branch Selection](img/branch-select.png)

Click on the branch selector again, and start typing the name of the branch you want to create. If you’ve been enabled for write access, you should see something like this:

![Branch Creation](img/branch-create.png)

Go ahead and select “Create branch”. At this point, you’ve created the branch on the github server. Now, you need to pull it locally. In your local shell, in the cribl-demo directory, type:

```
git fetch && git checkout <new branch name>
```

replacing `<new branch name>` with the name of the branch you just created. The `git fetch` reaches out to the repo for updates (which will include the new branch you just created), and then the `git checkout` pulls down the metadata locally, and switches your local to the newly created branch. Once you’ve done this, any git commands you issue will be operating on that branch.


## Exploring the Repository’s Structure

The directory structure looks something like this:

* [apiserver](apiserver/README.md)
* [cribl](cribl/README.md)
* [demo-cluster](demo-cluster/README.md)
* [gogen](gogen/README.md)
* [grafana](grafana/README.md)
* [influxdb2](influxdb2/README.md)
* [minio](minio/README.md)
* [mutating-webhook](mutating-webhook/README.md)
* [prometheus](prometheus/README.md)
* [redis](redis/README.md)
* [splunk](splunk/README.md)
* [telegraf](telegraf/README.md)

Most of these directories are used to configure the containers in the demo environment. Notable exceptions are:

* demo-cluster - this directory contains the files needed to set up an equivalent EKS cluster to the one we run for the demo environments.

* mutating-webhook - this is the mechanism that deploys appscope to all containers. This is currently working on the local minikube run, and not the EKS deploys (on the backlog).

## Pod Breakdown

There are a number of pods that have Init Containers (cribl master, minio, grafana, for example), but those disappear shortly after start up (Init Containers are used to "prep" things for another container, in our case mostly to set up structures and permissions on persistent volumes. If you do a `kubectl get pods`, you'll see something close to this: 

```
☁  cribl-demo [k8s] ⚡  kubectl get pods
NAME                                  READY   STATUS    RESTARTS   AGE
apiserver-6cd88dc44d-jsskt            1/1     Running   0          7m21s
baddev-674b4fd4c7-flpl7               1/1     Running   1          7m21s
cribl-778dc66c6b-sxdhr                1/1     Running   0          8m32s
cribl-sa-7q77w                        0/1     Pending   0          7m27s
cribl-w0-78b59b9bb9-p2q5c             1/1     Running   0          8m27s
cribl-w1-7cb54fd7bb-8p6xj             1/1     Running   0          8m20s
cribl-w2-557b6c4d8f-hddlk             1/1     Running   0          8m17s
gogen-57fb46fbd-9nnhq                 9/9     Running   0          7m21s
grafana-6dfd775544-8t6gb              1/1     Running   0          7m21s
influxdb2-0                           1/1     Running   0          8m9s
kube-state-metrics-846bf4c59d-6sg57   1/1     Running   0          7m26s
minio-6d8d6fdd8c-2v2l6                1/1     Running   0          7m20s
redis-86946b69c5-4rcjz                1/1     Running   0          7m20s
splunk-cfd767456-9dzhc                1/1     Running   0          7m21s
telegraf-telegraf-ds-s9bwf            1/1     Running   0          8m13s
```

The hashed values will obviously change from run to run, but here's a guide to what each pod provides:

|Name|Purpose|
|---|---|
|apiserver-\<unique id\>|A well behaved node express application|
|baddev-\<unique id\>|A poorly behaved node express application (for demoing AppScope)|
|cribl-\<unique id\>|The Cribl Master node - where all of the configuration info for logstream is managed|
|cribl-sa-\<unique id\>|A standalone job that seeds the demo environment with collection test data|
|cribl-w0-\<unique id\>|The `dc1-logs` worker group|
|cribl-w1-\<unique id\>|The `dc1-metrics` worker group|
|cribl-w2-\<unique id\>|The 'aws' worker group|
|gogen-\<unique id\>|a collection of containers running gogen configurations to generate data in the demo environment|
|grafana-\<unique id\>|the grafana instance|
|influx-db2-*|the influxdb database|
|kube-state-metrics-\<unique id\>|pod used to include kubernetes cluster metrics in the demo env|
|minio-\<unique id\>|MinIO container running S3 compatible data store|
|redis-\<unique id\>|Redis container preloaded with cache data|
|splunk-\<unique id\>|Splunk instance|
|telegraf-telegraf-\<unique id\>|Telegraf agent as a daemonset, providing additional k8s node metrics|


## Changing Configs

Since kubernetes doesn't support the same type of "pass-thru" volumes that docker-compose does, any changes you make within the containers (e.g. in the LogStream UI) will not carry back over into your local file tree. Because of this, you'll have to manually make the changes in the local tree. Luckily, there are a couple tricks that can make this a bit easier (but you will need to understand each container's configuration file hierarchy and where it stores different configuration items - the above about the repository structure should help, but is not at all exhaustive). 

### Trick #1 - the kubectl cp command

The kubectl cp command allows you to copy a file or group of files from a pod to your local disk. First, you'll need to know the name of the pod you want to copy from (see the Pod Breakdown, above), and then the syntax is:

`kubectl cp <pod name>:/path/to/file <local file name>`

For example, if I've made a change to the routes in the AWS worker group, and I'm in the top level of my cribl-demo repo, I'd run:

```
% kubectl cp cribl-778dc66c6b-sxdhr:/opt/cribl/config-volume/groups/aws/local/cribl/pipelines/route.yml cribl/master/groups/aws/local/cribl/pipelines/route.yml
tar: Removing leading `/' from member names
```

Once copied, you'll still need to do the git add, etc. to incporate it. Notice that it uses tar on the back end, so you can actually give it a directory name, and it will act more like cp -r, grabbing all files recursively and copying them locally into the <local file name> as a directory. 

### Trick #2 - using kubectl exec

Just like docker-compose has an exec feature to allow you to execute an arbitrary command on a container, so too does kubectl have an exec feature. This can be used in a few different ways:

#### Executing a remote command and capturing the output locally

This is actually how kubectl cp works, but if you execute a command remotely, you can redirect it's output into a file, through a pipe, etc. For example, say I want to grab a back up copy of the local and groups directories in the config-dir on the cribl master pod. I'd run this command:

```
kubectl exec <pod name> <-n namespace> -- bash -c "cd /opt/cribl/config-dir; tar cf - {local,groups}" > cribl_backup.tar 
```

You could do kubectl cp to grab each directory separately, but this drops it to a single command.

#### Grabbing a shell on a running container

If you need to get into a running container for any reason, you can use `kubectl exec` with the `-i` and `-t` arguments to get an interactive shell:

```
kubectl exec -i -t <-n namespace> <pod name> "--" sh -c "clear; (bash || ash || sh)" 
```

This command will work with most containers, due to the fact that it attempts `bash` first, and if that fails, `ash`, and finally as a catchall `sh`.

## Tracking Your Work

While you're working on your changes, commit changes often to your branch. If you're not familiar with this process, it requires three commands:

* `git add <file(s)>` - stages files for commit in the local branch.
* `git commit` - bundles all of the files/changes that have been added via `git add` into a single commit, prompting you for a message that explains what's being done in that commit. This is also only in the local branch. 
* `git push` - actually "pushes" the commit to the server version of the branch. This is important as it's the only step that will make your changes available to anyone else who might be using your branch. 

## Submitting your Pull Request

Once you're happy with your changes, you'll need to submit a pull request. Please tag Steve Litras as a reviewer. For info on how to create a pull request, see the github [Creating a Pull Request](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request) document.



