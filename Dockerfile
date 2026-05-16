# BUILD
FROM node:26-alpine as builder

WORKDIR /opt/src

RUN apk add --no-cache bash git python3 perl alpine-sdk

COPY quality-dashboard-server quality-dashboard-server

RUN cd quality-dashboard-server && \
    npm ci && \
    npm run build

COPY quality-dashboard-web quality-dashboard-web

RUN cd quality-dashboard-web && \
    npm ci && \
    npm run generate

# RUN
FROM node:26-alpine

RUN apk add --no-cache gzip

COPY --from=builder /opt/src/quality-dashboard-server/node_modules /opt/app/quality-dashboard/node_modules
COPY --from=builder /opt/src/quality-dashboard-server/dist /opt/app/quality-dashboard/dist
COPY --from=builder /opt/src/quality-dashboard-web/.output/public /opt/app/quality-dashboard/web
COPY quality-dashboard-server/processors_system /opt/app/quality-dashboard/processors_system
COPY quality-dashboard-server/config.json /opt/app/quality-dashboard/config.json
COPY quality-dashboard-server/sql /opt/app/quality-dashboard/sql

WORKDIR /opt/app/quality-dashboard

CMD [ "dist/App.js" ]