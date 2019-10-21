FROM redis:latest
ADD entrypoint.sh /sbin/entrypoint.sh
ADD loaddata.sh /sbin/loaddata.sh
ENTRYPOINT ["/sbin/entrypoint.sh"]
ADD http://cdn.cribl.io/dl/scope/latest/linux/libscope.so /usr/lib/libscope.so
RUN chmod 755 /usr/lib/libscope.so
ENV LD_PRELOAD=/usr/lib/libscope.so
ENV SCOPE_OUT_DEST=udp://cribl-w1:8125
ENV SCOPE_LOG_LEVEL=info
ENV SCOPE_LOG_DEST=file:///tmp/scope.log
ENV SCOPE_OUT_VERBOSITY=4
CMD ["start"]
