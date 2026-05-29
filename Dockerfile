FROM oven/bun:1.3.13-alpine

# Install Node.js for spawned background child processes
RUN apk add --no-cache nodejs

# Set working directory
WORKDIR /app

# Copy lockfile and package config
COPY package.json bun.lock ./

# Install dependencies (only production)
RUN bun install --production

# Copy the rest of the application code
COPY . .

# Expose port 6800
EXPOSE 6800

# Start the Bun webserver
CMD ["bun", "run", "server.js"]
