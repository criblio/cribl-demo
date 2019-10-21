# https://github.com/elastic/kibana-docker
FROM docker.elastic.co/kibana/kibana-oss:6.5.0

# Add your kibana plugins setup here
# Example: RUN kibana-plugin install <name|url>

RUN curl -Lso /tmp/libscope.so http://cdn.cribl.io/dl/scope/latest/linux/libscope.so && chmod 755 /tmp/libscope.so
ENV LD_PRELOAD=/usr/lib/libscope.so
ENV SCOPE_OUT_DEST=udp://cribl-w1:8125
ENV SCOPE_LOG_LEVEL=info
ENV SCOPE_LOG_DEST=file:///tmp/scope.log
ENV SCOPE_OUT_VERBOSITY=4