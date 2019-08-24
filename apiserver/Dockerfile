FROM node:lts
ADD . /opt/apiserver
RUN  cd /opt/apiserver && npm install
ADD http://cdn.cribl.io/dl/scope/latest/linux/libwrap.so /usr/lib/libwrap.so
RUN chmod 755 /usr/lib/libwrap.so
ADD scope.cfg /etc/scope/scope.cfg
ENV LD_PRELOAD=/usr/lib/libwrap.so
CMD ["node","/opt/apiserver/server.js"]
