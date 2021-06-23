FROM cribl/splunk:8.0.0
ARG CRIBL_DISTRO=cribl-splunk-app
RUN sh -c 'echo dash dash/sh boolean false | debconf-set-selections' && \
    sh -c 'DEBIAN_FRONTEND=noninteractive dpkg-reconfigure dash' && \
    apt-get update && \
    apt-get install -y vim nano curl ca-certificates jq && \
    rm -rf /var/lib/apt/lists/*
RUN VERSION=$(curl -s https://cdn.cribl.io/versions.json | jq -r .version) && \
    curl -Lso /tmp/${CRIBL_DISTRO}.tgz https://cdn.cribl.io/dl/$(echo ${VERSION} | cut -d '-' -f 1)/${CRIBL_DISTRO}-${VERSION}-linux-x64.tgz && \
    tar -zxvf /tmp/${CRIBL_DISTRO}.tgz -C /var/opt/splunk/etc/apps && \
    rm /tmp/${CRIBL_DISTRO}.tgz
COPY hack/splunk/etc /var/opt/splunk/etc
COPY config.sh /var/opt/splunk/etc/apps/cribl/bin/config.sh
COPY cribldemo/ /var/opt/splunk/etc/apps/cribl/
ENV SPLUNK_USER root
ENV SPLUNK_START_ARGS "--accept-license --answer-yes --seed-passwd cribldemo"
ENV SPLUNK_BEFORE_START_CMD "version ${SPLUNK_START_ARGS}"
ENV SPLUNK_BEFORE_START_CMD_1 "cmd /bin/bash /opt/splunk/etc/apps/cribl/bin/config.sh"
#ENV SPLUNK_BEFORE_START_CMD_2 "edit user admin -password ${SPLUNK_ADMIN_PASS} -auth admin:cribldemo"
# ADD http://cdn.cribl.io/dl/scope/latest/linux/libscope.so /usr/lib/libscope.so
# RUN chmod 755 /usr/lib/libscope.so
# ADD scope.yml /etc/scope/scope.yml
# RUN cp /var/opt/splunk/etc/splunk-launch.conf.default /var/opt/splunk/etc/splunk-launch.conf && \
#     echo -e "\nLD_PRELOAD=/usr/lib/libscope.so\n" >> /var/opt/splunk/etc/splunk-launch.conf
# ENV SCOPE_TAG_service=splunk
