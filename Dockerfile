# Base image
FROM python:3.10.6-slim
LABEL maintainer="https://github.com/marcuszou/"

# Update, install cron and some utilities
RUN apt-get update && apt-get install cron nano procps -y
# /usr/sbin/service cron start
RUN pip install --upgrade pip

# Copy files to work directory
WORKDIR /app
COPY . /app
# Install Python libraries in the WORKDIR!
RUN pip install -r requirements.txt

# Copy the cron job that runs the Python script every hour
#COPY mycrontab /app/mycrontab
RUN chmod +x /app/mycrontab
RUN crontab /app/mycrontab

# Expose port 8000 for the http.server
EXPOSE 8000
RUN python -m http.server 8000

# Run cron daemon in foreground (DO NOT fork)
ENTRYPOINT [ 'cron', '-f' ]
