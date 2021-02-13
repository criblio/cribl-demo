FROM ubuntu:20.04
RUN apt update && apt-get install -y curl gnupg2 && curl https://artifacts.elastic.co/GPG-KEY-elasticsearch | apt-key add - && \
    echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | tee /etc/apt/sources.list.d/elastic-7.x.list && \
    apt-get install -y apt-transport-https

RUN sh -c 'echo dash dash/sh boolean false | debconf-set-selections' && \
    sh -c 'DEBIAN_FRONTEND=noninteractive dpkg-reconfigure dash' && \
    apt-get update && \
    apt-get install -y vim curl ca-certificates jq filebeat && \
    rm -rf /var/lib/apt/lists/* 
ADD gogen /etc/gogen
ADD https://api.gogen.io/linux/gogen /usr/bin/gogen
RUN chmod 755 /usr/bin/gogen
ADD entrypoint.sh /sbin/entrypoint.sh
ADD filebeat*.yml /etc/filebeat/
RUN chmod 600 /etc/filebeat/*.yml && chown root:root /etc/filebeat/*.yml
RUN filebeat version
RUN find / -name filebeat -o -name filebeat.yml
ENTRYPOINT ["/sbin/entrypoint.sh"]
CMD ["start"]
