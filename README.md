# Turkey Earthquake Monitoring and Analysis System

### May God bless Turkish and Syrian people! And all the lucks go to the rescuers.



Project: **TEMAS** - **T**urkey **E**arthquake **M**onitoring and **A**nalysis **S**ystem

Latest Version: 0.8.0  |  Released: 17 March 2023  |  by: Marcus Zou



## Project Features

* This full-stack project is to keep tracking and visualize the earthquake events in Turkey, from January 2023 onwards. 
* The data table and maps shall be updated in a real-time fashion (every 2 hours or per your plan) and automatically.
* It's alive at https://temas.corunsol.net.

## Technical Intro

* The project landing page is: `index.html` while `app-updater.py` is a task to be scheduled every day.
* The `tuner_all-in-one_koeri_data.ipynb` is a debugging Jupyter notebook where I made the `app-updater.py` accordingly. Feel free to go through the steps out there.
* Made special edition of Docker image: **temas:0.8.0** (nginx as web server + cron).
* The original dataset (the base and the update) are mainly obtained from [Automatic Solutions page of Kandilli Observatory](http://www.koeri.boun.edu.tr/sismo/2/latest-earthquakes/automatic-solutions/).
* If the Automatic Solutions page stops updating, the alternative source is the [last earthquake snapshot](http://www.koeri.boun.edu.tr/scripts/lasteq.asp).

## Toolsets

```
 1. Python (3.10.6) + Folium library + Web Scraping technology
 2. Back-end databasing (SQLite3, will seek mySQL if the dataset gets big in the future)
 3. Bootstrapping the index.html
 4. Docker deployment
```



## How to Make Use of the Project

Two ways to use my project (**Method #1 is preferred** since it's just a piece of cake):

1. **Docker-Pull** method:

   1A) pull down the very Docker image:

   ```shell
   docker pull marcuszou/temas:0.8.0
   ```

   1B) run the docker image into a container while mapping "**./web**" folder on host to "**/app**" folder in the Docker container:

   ```bash
   docker run -d -p 8001:80 --name "TEMAS-0.8.0" -v ./web:/app -t temas:0.8.0
   ```
   
   1C) then you can launch a web browser to browse to - http://localhost:8001 to enjoy the project.

   

   **Note**: the web server and job runner (the daily scrapper) have been configured such that everything is running smoothly and automatically unless you shut down the docker container.

   

3. **Fork-n-Dock** method:
   
   3A) Clone the very repo:
   
   ```
   git clone https://github.com/marcuszou/temas.git
   ```
   
   3B) enter into the project folder and build a docker image:
   
   ```
   cd temas-main
   docker build --no-cache -t mytemas .
   ```
   
   3C) Run the docker image into a container:
   
   ```
   docker run -d -p 8001:80 --name "TEMAS" -v /web:/app -t mytemas
   ```
   
   3D) then you can launch a web browser to browse to - http://localhost:8001 to enjoy the project.

## Special Technical Report when Dockerizing the Project

 You may fork my project to your own space to play around and there are some observations to be noted as below:

* The small-sized `alpine` variant of Python docker images are kinda problematic due to (1) not updating Python to 3.10.6, but 3.10.0 and (2) lack of some core libraries leading to unable to install the `pandas` library (which is unbearable).

* Then the best smaller docker image shall be: `Python-3.10.6-slim` (45 MB only for downloading), which need you to schedule the `cron` job on the host though. 

* Eventually we are able to run the cron job within nginx Docker container, which ease our tasks extremely.

  

## Versions

* v0.8.0 build 2023-03-17 - Dockerfile tuned and nginx docker container added. Schedule the app-updater.py on the Host.

* v0.7.2 build 2023-03-13 - Changes on the job scheduler, .ignore files and finalizing. Pushed to github and cloud.

* v0.7.1 build 2023-03-12 - Scheduled a Data Updater and dockerized the project into a cloud service.

* v0.7.0 build 2023-03-11 - Tried to add Choropleth map, but lack of decent geojson file, re-org the project files and folders.

* v0.6.0 build 2023-03-10 - Split the jobs and Bootstrapped a landing page and other pages for the project.

* v0.5.0 build 2023-03-09 - Organized the all-in-one Jupyter Notebook: db-reader + scrapper + merger + mapper.

* v0.4.1 build 2023-03-08 - Scraping the multiple pages from sc3.koeri.boun.edu.tr/events/events{i}.html was successful.

* v0.4.0 build 2023-03-07 - Scraping the first page from sc3.koeri.boun.edu.tr/events/events.html was successful.

* v0.3.0 build 2023-03-04 - Created a SQLite3 db and saved the dataframe of Historic data into it.

* v0.2.1.build.2023-02-27 - Merged Historic and real-time data into one local dataframe.
* v0.2.0.build.2023-02-26 - Historic dataset added (from 16 Jan 2023).
* v0.1.0.build.2023-02-13 - First release - current 500 datapoints only.

## Live Earthquake Maps

* Bubble Map

![bubble-map](resources/live-earthquake-map-1.png)

* Heat Map

![heat-map](resources/live-earthquake-map-2.png)

## Credits

[KANDiLLi OBSERVATORY AND EARTHQUAKE RESEARCH INSTITUTE (1868)](http://www.koeri.boun.edu.tr/new/en)

[KANDiLLi Observatory Interactive Earthquake Map](http://udim.koeri.boun.edu.tr/zeqmap/)

This project is for educational purposes only. The copyrights of the data and values are exclusively owned by Boğaziçi University and Kandilli Observatory.

