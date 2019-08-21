#!/bin/sh
mkdir -p /var/log/gogen
mkdir /var/log/beats

if [ "$1" = "start" ]; then
    sh /sbin/loaddata.sh &
    redis-server
fi

exec "$@"
