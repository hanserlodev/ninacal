# syntax=docker/dockerfile:1
FROM debian:bookworm-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential cmake ninja-build libsqlite3-dev zlib1g-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY CMakeLists.txt ./
COPY src ./src
COPY third_party ./third_party
RUN cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-0 zlib1g ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/build/ninacal-server /usr/local/bin/ninacal-server

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8081/health || exit 1

ENTRYPOINT ["ninacal-server"]
CMD ["--db", "/data/ninacal.sqlite", "--data", "/data/web", "--host", "0.0.0.0", "--port", "8080", "--threads", "8"]
