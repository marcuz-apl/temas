# Run a Python Cron Job in Docker

by Marcus Zou | 17 March 2023

* Tested to be no issue

## 1. Create a very simple Python job

Here is a typical one named as `schrduler.py`:

```python
import datetime

now = datetime.datetime.now()
print("Hello, this is a Python job scheduler, completed at {0}\n".format(now))

```



## 2. Create the Dockerfile with Python pre-installed

Here is the Dockerfile:

```dockerfile
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

# Run cron foreground (dont fork in Docker due to the layered infrastucture)
CMD ["cron","-f"]

```

Please be noted: the **cron** command has to be "declared explicitly" - run in foreground in Docker due to the layered docker infrastructure. There are quite some tech writings stating "...it can be done/solved through a **bash** script as an **entrypoint**", which is very misleading and simply wrong and wasting your time.



## 3. Build the Docker image

```shell
docker build -t cronjob . # cronjon is the DOcker image name
```



## 4. Run the Docker Container

```shell
docker run --name "cronjob-con" -d -t cronjob # cronjob-con is the container while cronjob is the image
```



# 5. Check the cron job running in the Docker container

```shell
docker exec -it cronjob-con /bin/bash # cronjob-con is the running container
```

In the terminal (bash), type in `ls -la` after 1 minute to check if the cron.log has been created, then type in:

```bash
tail cron.log
```

 you should find a bunch of text lines, something like:

```tex
Hello, this is a Python job scheduler, completed at 2023-03-17 10:22:01.993851
Hello, this is a Python job scheduler, completed at 2023-03-17 10:23:02.085656
Hello, this is a Python job scheduler, completed at 2023-03-17 10:24:01.203708
Hello, this is a Python job scheduler, completed at 2023-03-17 10:25:01.314659
```

type "`exit`" to exit the `bash` prompt, then shut down the Docker container and image.



## End of the Test