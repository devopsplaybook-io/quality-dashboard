# BUILD
FROM node:16 as builder

WORKDIR /opt/app

COPY . .
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && \
  export CYPRESS_INSTALL_BINARY=0 && \
  npm ci && \
  npm run build:docker

# RUN
FROM nginx:alpine

RUN rm -fr /etc/nginx/conf.d/default.conf

COPY --from=builder /opt/app/dist /usr/share/nginx/html
COPY --from=builder /entrypoint.sh /entrypoint.sh
COPY docker/nginx/default.conf /etc/nginx/conf.d/

ENTRYPOINT [ "/entrypoint.sh" ]