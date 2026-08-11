FROM oven/bun:1-alpine

WORKDIR /app

RUN addgroup -S gateway && adduser -S -G gateway gateway

COPY package.json ./
RUN bun install --production

COPY server.js ./

USER gateway

EXPOSE 6820

CMD ["bun", "run", "server.js"]
