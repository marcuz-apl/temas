# Base image
FROM python:3.10.6-slim
LABEL maintainer="https://github.com/marcuszou/"

# Update, install cron and some utilities
RUN apt-get update
RUN apt-get install -y cron

# Copy files to work directory
WORKDIR /app
COPY . /app

# Setup cron to run every minute to print (you can add/update your cron here)
RUN touch /var/log/cron.log
RUN (crontab -l ; echo "* * * * * /usr/local/bin/python /app/scheduler.py >> /app/cron.log 2>&1") | crontab

# Run cron foreground (dont fork in Docker due to the layered infrastructure)
CMD ["cron","-f"]
