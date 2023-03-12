# Turkey Earthquake Monitoring and Analysis System

### May God bless Turkish and Syrian people! And all the lucks go to the rescuers.



Project: TEMAS - Turkey Earthquake Monitoring and Analysis System

Latest Version: 0.7.1 

Released: 12 March 2023 

by: Marcus Zou



## Project Intro

* This full-stack project is to keep tracking and visualize the earthquake events in Turkey, from January 2023 onwards. 

* The original dataset (the base and the update) are mainly obtained from [Kandilli Observatory](http://www.koeri.boun.edu.tr/).

* The data and maps shall be updated daily (in the early morning of MST) and automatically, then you may find a little out-of-date if you access our project website during the daytime of Mountain Standard Time (GMT-7).

* The project landing page is: index.html while app.py is a task to be scheduled every day.

* The Jupyter Notebook file of `tuner_all-in-one_koeri_data.ipynb` is a debugging notebook where I made the app.py accordingly. Feel free to go through the steps out there.

* The final project can be accessed at: https://temas.corunsol.net. 

## Toolsets

```
 1. Python (3.10.6) + Folium library + Web Scraping technology
 2. Back-end databasing
 3. Docker deployment
```

## Pre-requisite Libraries

```
  pip install -r requirements.txt
```

## Special Technical Report when Dockerizing the Project

 You may fork my project to your own space to play around and there are some observations to be noted as below:

* The small-sized `alpine` variant of Python docker images are kinda problematic due to (1) not updating Python to 3.10.6, but 3.10.0 and (2) lack of some core libraries leading to unable to install the `pandas` library (which is unbearable).

* Then the best smaller docker image shall be: `Python-3.10.6-slim` (45 MB only for downloading), which need you to install `cron` module in the `Dockerfile` though. 

* A light-weight Http Server has to run to serve the http requests to our website (`index.html`).

  

## Versions

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

