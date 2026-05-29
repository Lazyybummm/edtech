FROM node:20-slim

# Install ffmpeg for video processing and clean up apt cache to keep image small
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Create the temp_videos directory to prevent runtime errors
RUN mkdir -p temp_videos

EXPOSE 3000

# Assuming your entry point is server.js
CMD ["node", "server.js"]

