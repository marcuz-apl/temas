# Base image
FROM python:3.10.6-slim
LABEL maintainer="https://github.com/marcuszou/"

# Update, install cron and some utilities
RUN apt-get update && apt-get install nano -y

# Copy files to work directory
WORKDIR /app
COPY ./web /app

EXPOSE 8000

CMD python /app/app-httpsvr.py
