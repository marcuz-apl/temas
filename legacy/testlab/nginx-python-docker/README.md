# Run a Cron Job in nginx Docker

by Marcus Zou | 17 March 2023



## Questions

It seems that running a `cron` job in a `nginx` docker container is a Mission Impossible:

Question is from https://www.reddit.com/r/docker/comments/kisafw/how_to_run_cron_with_nginx_service_together/, stating -

----

I created a docker image to run crontab based on the official nginx image.

```
FROM nginx

RUN apt-get update && apt-get -y install cron

CMD ["cron", "-f"]
```

If I don't set the last line `CMD ["cron", "-f"]`, crontab service can't start after run it as a container. 

But if I set it, nginx can't start.

```
docker build -t some-content-nginx .
docker run --name some-nginx -d -p 8080:80 some-content-nginx
(Nginx isn't running)
```

How to start these 2 services together?

----

Generally speaking, we only run one process per container, and so we'd run a separate cron container. but in some cases, there is a need to run cron and nginx in the same container. for instance, a user wants to use `crontab` to monitor logrotate for nginx logs in one container. In other container it can't get nginx's pid.

### 1. Bind-mounting method

An alternative way is to consider the default `nginx` image setting that writes logs to the `docker logs` output, or bind-mounting a host directory over `/var/log/nginx`. Either of those would let you use a host-based log-management solution that doesn't need special support inside the container.

### 2. Entrypoint-wrapper method

One way to achieve this is to wrap the nginx image's entrypoint file in an entrypoint of you own, whose job is to start the `cron` service and then hand off to the standard docker-nginx entrypoint. The `nginx` image uses the entrypoint `/docker-entrypoint.sh`, so we just need to start `cron` and pass the command to that script, using an entrypoint like:

```
#!/bin/bash

cron && /docker-entrypoint.sh "$@"
```

Here's a simple Dockerfile that creates the necessary entrypoint and overrides the entrypoint in the base image:

```
FROM nginx

RUN apt-get update && apt-get install -y cron && \
    echo '#!/bin/bash\n\ncron && /docker-entrypoint.sh "$@"' >> entrypoint-wrapper.sh && \
    chmod +x /entrypoint-wrapper.sh

ENTRYPOINT ["/entrypoint-wrapper.sh"]

# Have to reset CMD since it gets cleared when we set ENTRYPOINT
CMD ["nginx", "-g", "daemon off;"]
```

#### Sample run

```
$ docker run --name nginx-cron --detach nginx-cron
34301405f7b426022d9c286ff4e00f1c58570d76c5aba6b9f1c50ef698829976
$ docker exec nginx-cron service cron status
cron is running.
$ docker exec nginx-cron service nginx status
nginx is running.
```



For my case, I have to run a `cron` job based on Python script every 2 hours, the resultant webpages (in HTML format) will be published into a folder shared out to port 8000 on host.

## 1. Create a very simple Python scheduler

Here is a typical one named as `schrduler.py`:

```python
import datetime
now = datetime.datetime.now()
print("Hello, this is a Python job scheduler, completed at {0}\n".format(now))
```



## 2. Create the Dockerfile with Python pre-installed

Here is the Dockerfile:

```dockerfile
# Base Image
FROM nginx:stable
# Install the python3 and cron
RUN apt-get update && apt-get install -y python3 nano cron

# Cop the files over
WORKDIR /app
COPY . .

# Create cron job
RUN touch /app/cron.log
RUN (crontab -l ; echo "* * * * * /usr/local/bin/python /app/scheduler.py >> /app/cron.log 2>&1") | crontab
#RUN crontab /app/mycrontab

RUN rm -rf /usr/share/nginx/html/*
COPY index.html /usr/share/nginx/html/index.html

# I have put into a file named entrypoint-wrapper.sh, then the floowing command is not needed
# RUN echo '#!/bin/bash\n\ncron && /docker-entrypoint.sh "$@"' >> /app/entrypoint-wrapper.sh
RUN chmod +x /app/entrypoint-wrapper.sh

ENTRYPOINT ["/app/entrypoint-wrapper.sh"]

# Have to reset CMD since it gets cleared when we set ENTRYPOINT
CMD ["nginx", "-g", "daemon off;"]

```

Please be noted: the **cron** command has to be "declared explicitly" - run in foreground in Docker due to the layered docker infrastructure. There are quite some tech writings stating "...it can be done/solved through a **bash** script as an **entrypoint**", which is very misleading and simply wrong and wasting your time.



## 3. Build the Docker image

```shell
docker build -t nginx-py . # nginx-py is the DOcker image name
```



## 4. Run the Docker Container

```shell
docker run --name "nginx-py-cron" -d -t nginx-py 
# nginx-py-cron is the container while nginx-py is the image
```



# 5. Check the cron job and nginx server BOTH running in the Docker container

```shell
$ docker exec nginx-py-cron service cron status
cron is running.
$ docker exec nginx-py-cron service nginx status
nginx is running.
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