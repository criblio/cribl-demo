FROM node:lts
ADD . /opt/apiserver
RUN  cd /opt/apiserver && npm install
<<<<<<< HEAD
ADD http://cdn.cribl.io/dl/scope/latest/linux/libwrap.so /usr/lib/libwrap.so
RUN chmod 755 /usr/lib/libwrap.so
# ENV LD_PRELOAD=/usr/lib/libwrap.so
=======
ADD http://cdn.cribl.io/dl/scope/latest/linux/libscope.so /usr/lib/libscope.so
RUN chmod 755 /usr/lib/libscope.so
ENV LD_PRELOAD=/usr/lib/libscope.so
>>>>>>> 3154f63402f8aaed8cefc5df4a44c3d94778e8a1
ENV SCOPE_OUT_DEST=udp://cribl:8125
ENV SCOPE_LOG_LEVEL=info
ENV SCOPE_LOG_DEST=file:///tmp/scope.log
ENV SCOPE_OUT_VERBOSITY=5
CMD ["node","/opt/apiserver/server.js"]
