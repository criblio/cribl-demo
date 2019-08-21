FROM redis:alpine
ADD entrypoint.sh /sbin/entrypoint.sh
ADD loaddata.sh /sbin/loaddata.sh
ENTRYPOINT ["/sbin/entrypoint.sh"]
CMD ["start"]