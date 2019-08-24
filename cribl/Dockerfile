FROM cribl/cribl:beta
COPY http_status.csv /opt/cribl/data/lookups/http_status.csv
COPY scripts/ /opt/cribl/scripts/
ADD http://cdn.cribl.io/dl/scope/latest/linux/libwrap.so /usr/lib/libwrap.so
RUN chmod 755 /usr/lib/libwrap.so
ADD scope.cfg /etc/scope/scope.cfg
ENV LD_PRELOAD=/usr/lib/libwrap.so
