# syntax=docker/dockerfile:1
FROM node:24-trixie-slim

WORKDIR /app

# Install dependencies first for better caching
COPY app/package*.json ./
RUN npm ci

# Copy application source
COPY app/ ./

ENV NODE_ENV=production
EXPOSE 3232

CMD ["npm", "start"]