FROM nginx:1.25-alpine

# Create non-privileged user
RUN addgroup -S nginxgroup && adduser -S nginxuser -G nginxgroup

# Create necessary directories and set permissions
RUN mkdir -p \
    /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
    /var/run \
    && chown -R nginxuser:nginxgroup /var/cache/nginx /var/run \
    && chmod -R 755 /var/cache/nginx /var/run \
    # Remove default conf.d files and entrypoint scripts
    && rm -rf /etc/nginx/conf.d/* \
    && rm -rf /docker-entrypoint.d/*

# Copy Nginx configuration
COPY --chown=nginxuser:nginxgroup nginx.conf /etc/nginx/nginx.conf

# Copy frontend files
COPY --chown=nginxuser:nginxgroup frontend/ /usr/share/nginx/html/

# Create pid file with correct permissions
RUN touch /var/run/nginx.pid && chown nginxuser:nginxgroup /var/run/nginx.pid

USER nginxuser

EXPOSE 80