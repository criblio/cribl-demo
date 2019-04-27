#!/bin/sh

mkdir -p /var/log/beats

if [ "$1" = "start" ]; then
    filebeat -c /etc/filebeat/filebeat.yml run
fi

exec "$@"
