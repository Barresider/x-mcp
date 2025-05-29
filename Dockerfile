# Use a Node.js image for building the server
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the entire source code into the working directory
COPY . .

# Build the TypeScript files
RUN npm run build

# Use the official Playwright image for runtime (includes browsers)
FROM mcr.microsoft.com/playwright:v1.44.0-focal AS runner

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    xauth \
    dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the runtime image
WORKDIR /app

# Copy the build files from the builder image
COPY --from=builder /app/dist ./dist

# Copy package.json and package-lock.json for production install
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the necessary source files that might be needed at runtime
COPY src/behaviors ./src/behaviors
COPY src/scrapers ./src/scrapers
COPY test.jpg ./

RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -noreset &\n\
sleep 1\n\
export DISPLAY=:99\n\
echo "Starting application..."\n\
exec node dist/mcp.js\n\
' > /app/start.sh && chmod +x /app/start.sh

# Start the application with Xvfb
CMD ["/app/start.sh"]