# Base image
FROM nginx:stable
LABEL maintainer="https://github.com/marcuszou/"

# Update, install cron and some utilities
RUN apt-get update && apt-get install -y python3 nano cron

# Copy files to work directory
WORKDIR /app
COPY . .

# Create cron job
RUN touch /app/cron.log
RUN crontab /app/mycrontab

# Organize nginx html folder
RUN rm -rf /usr/share/nginx/html/*
COPY ../web/ /usr/share/nginx/html/

## please tune the parameters in the confiles
## /etc/nginx/nginx.conf 
## /etc/nginx/conf.d/default.conf

# Ops on entrypoint-wrapper
RUN chmod +x /app/entrypoint-wrapper.sh
ENTRYPOINT ["/app/entrypoint-wrapper.sh"]

# Have to reset CMD since it gets cleared when we set ENTRYPOINT
CMD ["nginx", "-g", "daemon off;"]
