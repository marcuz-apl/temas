# Base Image
FROM nginx:stable
# Install the python3 and cron
RUN apt-get update && apt-get install -y python3 nano cron

# Cop the files over
WORKDIR /app
COPY . .

# Create cron job
RUN touch /app/cron.log
#RUN (crontab -l ; echo "* * * * * /usr/local/bin/python /app/scheduler.py >> /app/cron.log 2>&1") | crontab
RUN crontab /app/mycrontab

RUN rm -rf /usr/share/nginx/html/*
COPY index.html /usr/share/nginx/html/index.html

# I have put into a file named entrypoint-wrapper.sh, then the floowing command is not needed
# RUN echo '#!/bin/bash\n\ncron && /docker-entrypoint.sh "$@"' >> /app/entrypoint-wrapper.sh
RUN chmod +x /app/entrypoint-wrapper.sh
