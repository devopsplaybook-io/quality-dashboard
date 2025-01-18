#!/bin/sh


# Set BASEPATH_SERVER
if [ "${BASEPATH_SERVER}" = "" ]; then
    BASEPATH_SERVER=/api
fi
echo "BASEPATH_SERVER: ${BASEPATH_SERVER}"
find /usr/share/nginx/html -type f | grep -v \.ico | xargs sed -i "s@BASEPATH_SERVER@${BASEPATH_SERVER}@g"


# Set BASEPATH
if [ "${BASEPATH}" = "" ]; then
    BASEPATH=/
fi
echo "BASEPATH: ${BASEPATH}"
BASEPATH_ESC=${BASEPATH}
if [ "${BASEPATH_ESC: -1}" != "/" ]; then
    BASEPATH_ESC="${BASEPATH_ESC}/"
fi
find /usr/share/nginx/html -type f | grep -v \.ico | xargs sed -i "s@/BASEPATH/@${BASEPATH_ESC}@g"
sed -i "s@BASEPATH@${BASEPATH_ESC}@g" /etc/nginx/conf.d/default.conf


# Start NGINX
nginx -g 'daemon off;'
