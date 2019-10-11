# https://github.com/elastic/kibana-docker
FROM docker.elastic.co/kibana/kibana-oss:6.5.0

# Add your kibana plugins setup here
# Example: RUN kibana-plugin install <name|url>

RUN curl -Lso /tmp/libwrap.so https://cdn.cribl.io/dl/scope/latest/linux/libwrap.so && chmod 755 /tmp/libwrap.so
RUN chmod 755 /tmp/libwrap.so
ENV LD_PRELOAD=/usr/lib/libwrap.so
ENV SCOPE_OUT_DEST=udp://localhost:8125
ENV SCOPE_LOG_LEVEL=info
ENV SCOPE_LOG_DEST=file:///tmp/scope.log
ENV SCOPE_OUT_VERBOSITY=4