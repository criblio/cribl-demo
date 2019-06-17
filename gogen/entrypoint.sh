#!/bin/sh
if [ "$1" = "start" ]; then
    gogen -v -cd /etc/gogen -o http --url http://cribl:10200/_bulk -ot elasticsearch -at -lj gen -s authfailed 2>| nc cribl 10001 &
    gogen -v -cd /etc/gogen -o http --url http://cribl:10088/services/collector/event -ot splunkhec -at -lj gen -s businessevent 2>| nc cribl 10001 &
    gogen -v -cd /etc/gogen -o tcp --url cribl:5140 -ot rfc5424 -at -lj gen -s statechange 2>| nc cribl 10001 &
    gogen -v -cd /etc/gogen -o kafka --url kafka:29092 --topic cribl -ot json -at -lj gen -s bigjson 2>| nc cribl 10001 &
    gogen -v -cd /etc/gogen -o tcp --url cribl:8125 -lj gen -s metrics 2>| nc cribl 10001 &
    gogen -v -cd /etc/gogen -o splunktcpuf --url cribl:9999 -ot splunktcpuf -lj gen -s shoppingapache 2>| nc cribl 10001
fi

exec "$@"
