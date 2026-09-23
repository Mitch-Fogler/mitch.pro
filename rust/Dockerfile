# mitch Rust services — multi-stage build with cargo-chef for layer caching.
# Build-only for now; exercised in plan Step 2 (mail sidecar) and finalized at
# Step 15 (blue/green cutover). Final image is musl-static so the binaries run
# anywhere, mirroring the prod Dockerfile's non-root `bun` user.

FROM lukemathwalker/cargo-chef:latest-rust-1-alpine AS chef
RUN apk add --no-cache pkgconfig openssl-dev openssl-libs-static musl-dev make perl
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json -j 2
COPY . .
RUN cargo build --release --workspace -j 2

FROM alpine:3.20
RUN apk add --no-cache openssh-client ffmpeg ca-certificates curl openssl
RUN addgroup -g 1000 app && adduser -u 1000 -G app -D -s /bin/sh app
COPY --from=builder /app/target/release/mitch-* /usr/local/bin/
USER app
# Each service selects its binary via MITCH_SERVICE; compose sets this.
ENV MITCH_SERVICE=mitch-server
ENTRYPOINT ["/bin/sh", "-c", "exec /usr/local/bin/${MITCH_SERVICE:-mitch-server}"]