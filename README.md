# Cribl Demo

This repo is used for building and running Cribl demos. All demos contained within utilize Docker. There are a few scenarios we have built:

1. Cribl with Splunk - Single Container
2. Cribl Routing Demo

All demos have Cribl and Splunk running. In demos 2 and 2, the Cribl credentials are `admin/admin`. In 1, we use the Splunk credentials, which in all demos are `admin/cribldemo`. Here are the URLs:

* https://localhost:8000/en-US/account/insecurelogin?loginType=splunk&username=admin&password=cribldemo- Splunk
* https://localhost:9000/login?username=admin&password=cribldemo - Cribl Demo 1
* http://localhost:9000/login?username=admin&password=admin - Cribl Demo 2 & 3

Also, in 2 & 3 we've configured Cribl to send to S3 which we're emulating with [Minio](https://github.com/minio/minio). In the demo, the `data` folder will contain data being passed through Cribl and sent to S3 every 60 seconds.

## Data

Data for this demo comes from two sources: [Gogen](https://github.com/coccyx/gogen) and [Filebeat](https://github.com/elastic/beats). Gogen is configured to generate fake data like Weblogs, Transaction logs, etc. It will backfill one hour's worth of data on startup, which you will see as a spike in the graphs. Secondly, Filebeat is configured to grab logs from Docker.

# Scenarios

## Cribl with Splunk - Single Container

This demo has everything contained in a single container. This demo grabs `cribl-demo-splunk-app`, which contains a data generator (mirrored in the `gogen` directory as well). Data flows like:

    Gogen
    `- Stdout Modinput XML
    `- Splunk
    `- S2S -> Localhost:9999
    `- Cribl
    `- S2S -> Localhost:10000
    `- Splunk Indexer

Data is deposited in Splunk in the `cribl` index and Cribl mirrors it to the `cribl-modified` index.

To run the demo, run `start.sh` in the `splunk` directory. To stop the demo, run `stop.sh` in the `splunk` directory.

## Cribl Routing Demo

This demo splits out data generation and Cribl out into seperate containers. Data flows like:

    Gogen
    `- HTTP -> cribl:10001
    `- Splunk Universal Forwarder -> cribl:9999
    `- TCP -> cribl:10001
    `- Syslog -> cribl:10003
    `- Kafka - topic cribl
    `- Cribl
      `- S2S -> splunk:9997
      `- Elastic Bulk Ingestion -> elastic:9200
      `- S3 -> minio:80

Data in Splunk also ends up in the `cribl` index. Elastic index is also named `cribl` and `minio` ends up in the `cribl` bucket.

The demo requires root initially to read the Docker containers folder. To run the demo, run `DOCKER_LIB_CONTAINERS=$(docker info -f '{{.DockerRootDir}}')/containers && sudo DOCKER_LIB_CONTAINERS=${DOCKER_LIB_CONTAINERS} docker-compose up -d`. To stop the demo, run `docker-compose down`.
