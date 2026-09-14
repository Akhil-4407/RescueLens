# Stage 1: Build the Vite React application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies with frozen lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files
COPY . .

# Build production bundle with relative API path for Nginx reverse proxy
ENV VITE_API_BASE_URL=""
RUN npm run build

# Stage 2: Serve static distribution with Nginx Alpine
FROM nginx:alpine

# Remove default nginx html
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port 80
EXPOSE 80

# Healthcheck to ensure Nginx is responding
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
