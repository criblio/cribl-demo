# Cribl Demo

This repo is used for building and running Cribl demos. All demos contained within utilize [Docker](https://docs.docker.com/install/). To get started, all you need to do is:

    git clone https://github.com/criblio/cribl-demo.git
    cd cribl-demo
    docker-compose up -d

This will launch a Cribl demo environment with a number of sources and destinations. Several of these systems expose their own interfaces, like Cribl, Splunk and Elasticsearch (Kibana):

| System                 | URL                                                                                                    | Username | Password  |
|------------------------|--------------------------------------------------------------------------------------------------------|----------|-----------|
| Cribl                  | http://localhost:9000/login?username=admin&password=cribldemo                                          | admin    | cribldemo |
| Splunk                 | http://localhost:8000/en-US/account/insecurelogin?loginType=splunk&username=admin&password=cribldemo- | admin    | cribldemo |
| Elasticsearch (Kibana) | http://localhost:9200                                                                                  |          |           |
| Grafana                | http://localhost:8200                                                                                  | admin    | cribldemo |
| Graphite               | http://localhost:8100                                                                                  |          |           |

## How to start data flowing into demo systems

1. Under Worker Groups: click on Commit for each worker to commit the configuration changes to git (local)
2. Click on Deploy to deploy the changes to each worker. Workers that belong to the group will start pulling updated configurations on their next check-in.
3. Wait a few seconds for changes to take effect

## What to see first

The Cribl UI shows you all the sources, routes and pipelines and will give you a good overview of the types of data flowing in real time.

The Splunk environment contains a number of dashboards which shows off use cases for Cribl. It's a nice overview of the capabilities, and it contains easy links to the pipelines which are reshaping the data.

## Data Sources & Destinations

Data for this demo comes from two sources: [Gogen](https://github.com/coccyx/gogen) and [Filebeat](https://github.com/elastic/beats). Gogen generates data through a number of different protocols, like HTTP, Splunk Universal Forwarder, TCP JSON, Syslog, and onto a Kafka bus. Cribl is configured to receive or pull from all of those particular protocols. Gogen is configured to generate fake data like Weblogs, Transaction logs, etc. It will backfill one hour's worth of data on startup, which you will see as a spike in the graphs. Secondly, Filebeat is configured to grab logs from Docker.

    Gogen
    `- HTTP -> cribl:10001
    `- Splunk Universal Forwarder -> cribl:9999
    `- TCP -> cribl:10001
    `- Syslog -> cribl:10003
    `- Kafka - topic cribl
    `- Dogstatsd -> cribl:8125
      `- Cribl
        `- S2S -> splunk:9997
        `- Elastic Bulk Ingestion -> elastic:9200
        `- S3 -> minio:80
        `- Graphite -> graphite:2003

On the output side, Cribl is outputting to Splunk, Elasticsearch, Graphite, and S3 (Minio). Data can be found in the following locations:

| System        | Data Location        |
|---------------|----------------------|
| Splunk        | index=cribl          |
| Splunk        | index=cribl-modified |
| Elasticsearch | filebeat-*           |
| Elasticsearch | bigjson              |
| Elasticsearch | bigjson-trimmed      |
| Minio         | ./data               |


## Stopping the demo

Stop the demo through `docker-compose`:

    docker-compose down

## Errata

We use Elastic Filebeat to pick up logs from the docker container. This may require you to run docker as root in order to access `/var/run/docker.sock`. In that case you may need to run `sudo docker-compose up -d` to run the demo. 

If you have docker in a non-standard location, we may need to find a different root directory. If Filebeat still isn't picking up logs, you can try running: `DOCKER_LIB_CONTAINERS=$(docker info -f '{{.DockerRootDir}}')/containers && sudo DOCKER_LIB_CONTAINERS=${DOCKER_LIB_CONTAINERS} docker-compose up -d`.
