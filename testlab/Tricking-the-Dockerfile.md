# Scheduler and Python http.server in Docker

It turns out scheduling a Python job (.py file) and running the simple Python http.server in the same time in Dockerfile is a challenge. was fixating on "`nohup python /app/app-http.server.py`" using bash or direct running, none of the approaches makes miracle. Eventually a few discussions with **ChatGPT** actually helped me.

Here is what **ChatGPT** says - with some modification per our case though.

----

To schedule a Python job and run the Python http.server in the same time in a Dockerfile, you can use `cron` to schedule the job and `CMD` to run the http.server.

Here's an example Dockerfile:

```
FROM python:3.10.6-slim

# Set working directory
WORKDIR /app

# Copy the Python script that you want to run
COPY scheduler.py .

# Install cron
RUN apt-get update && apt-get -y install cron

# Create a cron job that runs the Python script every minute
RUN echo "* * * * * python /app/scheduler.py >> /var/log/cron.log 2>&1" >> /etc/crontab

# Expose port 8000 for the http.server
EXPOSE 8000

# Set the command to run the http.server
CMD python -m http.server
```

In this example, the `scheduler.py` file is copied into the `/app` directory, and a cron job is created that runs the script every minute. The output of the script is redirected to `/var/log/cron.log`.

The `EXPOSE` command exposes port 8000, which is the default port used by the http.server. Finally, the `CMD` command runs the http.server.

When you build and run the Docker image, the Python script will be run every minute via the cron job, and the http.server will be running and listening on port 8000.