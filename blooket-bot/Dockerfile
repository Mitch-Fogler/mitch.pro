FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Python 3 and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Install python dependencies and playwright python bindings
RUN pip install --no-cache-dir playwright playwright-stealth

# Download chromium browser for python playwright
RUN python3 -m playwright install chromium

WORKDIR /app

# Copy package config and install dependency
COPY package.json ./
RUN npm install

# Copy source files
COPY join_blooket.py /app/
COPY cheats /app/cheats
COPY bookmarks_7_26_26.html /app/
COPY server.js /app/
COPY cheat-blooket-gui.bookmarklet.js /app/

# Expose microservice port
EXPOSE 8082

# Start the microservice server
CMD ["node", "server.js"]
