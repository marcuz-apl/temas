FROM python:3.10.6-slim
LABEL maintainer="https://github.com/marcuszou/"

RUN apt-get update && apt-get install -y cron
WORKDIR /app
COPY . /app

RUN pip install -r requirements.txt
RUN chmod a+x /app/app-httpsvr.py

COPY mycrontab /etc/cron.d/mycrontab
RUN chmod 0644 /etc/cron.d/mycrontab
RUN /usr/bin/crontab /etc/cron.d/mycrontab

# run crond as main process of container
CMD ["cron", "-f"]
