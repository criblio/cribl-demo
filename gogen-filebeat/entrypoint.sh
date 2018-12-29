#!/bin/sh
mkdir -p /var/log/gogen
mkdir /var/log/beats

if [ "$1" = "start-kafka" ]; then
    mkdir /var/log/httpd
    gogen -v -cd /etc/gogen -o file --filename /var/log/httpd/access.log gen -s shoppingapache > /var/log/gogen/apache.log 2>&1 &
    mkdir -p /opt/be/log
    gogen -v -cd /etc/gogen -o file --filename /opt/be/log/transaction.log gen -s businessevent > /var/log/gogen/transaction.log 2>&1 &
    gogen -v -cd /etc/gogen -o file --filename /opt/be/log/auth.log gen -s authfailed > /var/log/gogen/authfailed.log 2>&1 &
    filebeat -c /etc/filebeat/filebeat-kafka.yml run
elif [ "$1" = "start-direct" ]; then
    filebeat -c /etc/filebeat/filebeat.yml run &
    gogen -v -cd /etc/gogen -o tcp --url cribl:10001 -ot json -at gen
fi

exec "$@"
