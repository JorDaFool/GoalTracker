FROM alpine:3.20

ARG PB_VERSION=0.39.11

RUN apk add --no-cache unzip ca-certificates curl \
    && ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/') \
    && curl -Lo /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${ARCH}.zip" \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && apk del unzip curl

WORKDIR /pb
COPY pb_migrations /pb/pb_migrations

EXPOSE 8090
ENTRYPOINT ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090"]
