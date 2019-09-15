FROM node:lts
ADD . /opt/apiserver
RUN  cd /opt/apiserver && npm install
ADD http://cdn.cribl.io/dl/scope/latest/linux/libwrap.so /usr/lib/libwrap.so
RUN chmod 755 /usr/lib/libwrap.so
ENV LD_PRELOAD=/usr/lib/libwrap.so
ENV SCOPE_OUT_DEST=udp://cribl:8125
ENV SCOPE_LOG_LEVEL=info
ENV SCOPE_LOG_DEST=file:///tmp/scope.log
ENV SCOPE_OUT_VERBOSITY=5
CMD ["node","/opt/apiserver/server.js"]
