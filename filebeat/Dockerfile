FROM ubuntu:18.04
RUN sh -c 'echo dash dash/sh boolean false | debconf-set-selections' && \
    sh -c 'DEBIAN_FRONTEND=noninteractive dpkg-reconfigure dash' && \
    apt-get update && \
    apt-get install -y vim curl ca-certificates jq && \
    rm -rf /var/lib/apt/lists/*
RUN curl -Lso /tmp/filebeat.tgz https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-oss-6.7.0-linux-x86_64.tar.gz && \
    mkdir -p /tmp/filebeat && \
    tar zxf /tmp/filebeat.tgz -C /tmp/filebeat --strip=1 && \
    mv /tmp/filebeat/filebeat /usr/bin/filebeat && \
    rm -rf /tmp/filebeat*
ADD entrypoint.sh /sbin/entrypoint.sh
ADD filebeat*.yml /etc/filebeat/
RUN chmod 600 /etc/filebeat/*.yml && chown root:root /etc/filebeat/*.yml
ENTRYPOINT ["/sbin/entrypoint.sh"]
CMD ["start"]
