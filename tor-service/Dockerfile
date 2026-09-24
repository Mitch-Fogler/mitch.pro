FROM alpine:3.20

# Install Tor, Python 3, networking tools, and runtime dependencies
RUN apk add --no-cache \
    tor \
    python3 \
    py3-pip \
    py3-aiohttp \
    py3-requests \
    py3-urllib3 \
    curl \
    iptables \
    iproute2 \
    bash \
    ca-certificates

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY tor_manager.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

# User Tor directories
RUN mkdir -p /var/lib/tor_users && chmod 777 /var/lib/tor_users

EXPOSE 6840

ENTRYPOINT ["/app/entrypoint.sh"]
