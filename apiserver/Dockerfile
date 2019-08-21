FROM node:lts-alpine
ADD . /opt/apiserver
RUN  cd /opt/apiserver && npm install
CMD ["node","/opt/apiserver/server.js"]
