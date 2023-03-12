## TEMAS - Turkey Earthquake Monitoring and Analysis System

# PART 0. Prep
import os
import pandas as pd
import folium
from folium import plugins
import branca
from branca.colormap import StepColormap
from pretty_html_table import build_table
import datetime as dt
import sqlite3
import requests
from bs4 import BeautifulSoup

print('\nTEMAS 0.7\n\nMission Started on', dt.datetime.now(), ', be patient....\n')

## PART 1. Web Scrapping Real-time Data

print('Mission #1 - Web Scrapping the Real-time Data...')
# send a GET request to the URL - the first page
url0 = "http://sc3.koeri.boun.edu.tr/eqevents/events.html"
response = requests.get(url0)
# parse the HTML content of the page with BeautifulSoup
soup = BeautifulSoup(response.content, "html.parser")

data0 = []
# find the table element and iterate over its rows
table = soup.find("table", {'class': 'index'})
rows = table.find_all("tr", {'class': 'trIndevnrow'})[1:]
for row in rows:
    # get the cells in the row
    cols = row.find_all("td")
    # get the earthquake information from the columns
    origintimeutc = cols[0].text.strip()
    magnitude = cols[1].text.strip()
    magType = cols[2].text.strip()
    lat = cols[3].text.strip()
    long = cols[4].text.strip()
    depth = cols[5].text.strip()
    region = cols[6].text.strip()
    am = cols[7].text.strip()
    lastUpd = cols[8].text.strip()
    kml = cols[9].text.strip()
    
    data0.append([origintimeutc, magnitude, magType, lat, long, depth, region, am, lastUpd, kml])
        
df0 = pd.DataFrame(data0, columns=['origintimeutc', 'magnitude', 'magType', 'latitude', 'longitude', 'depthKM', 'region', 'measMethod', 'updTime', 'attribute'])

# Scrapping Multiple Pages
data1 = []
# loop through the pages 1-9
for i in range(1,9):
    # specify the URL to scrape
    url = f"http://sc3.koeri.boun.edu.tr/eqevents/events{i}.html"
    
    # make a GET request to the URL and get the HTML content
    response = requests.get(url)
    html_content = response.content
    
    # parse the HTML content using BeautifulSoup
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # find the earthquake table
    eq_table = soup.find('table', {'class': 'index'})
    
    # loop through the rows of the table
    for row in eq_table.find_all('tr', {'class': 'trIndevnrow'})[1:]:
        # get the columns of the row
        cols = row.find_all('td')
        
        # get the earthquake information from the columns
        origintimeutc = cols[0].text.strip()
        magnitude = cols[1].text.strip()
        magType = cols[2].text.strip()
        lat = cols[3].text.strip()
        long = cols[4].text.strip()
        depth = cols[5].text.strip()
        region = cols[6].text.strip()
        am = cols[7].text.strip()
        lastUpd = cols[8].text.strip()
        kml = cols[9].text.strip()
        
        data1.append([origintimeutc, magnitude, magType, lat, long, depth, region, am, lastUpd, kml])
        
df1 = pd.DataFrame(data1, columns = ["origintimeutc", "magnitude", "magType", "latitude", "longitude", "depthKM", "region", "measMethod", "updTime", "attribute"])

# Concatenate 2 realtime dataframes
rtDF = pd.concat([df0, df1]).drop_duplicates(subset='origintimeutc', keep='last')
# Reset the Index
rtDF = rtDF.reset_index(drop=True)

print('Mission #1 - Completed.\n')

## PART 2. Load Historic Data from Local Database

print('Mission #2 - Retrieving the Historic Data from Database...')
# Create a connection to the databse
conn = sqlite3.connect('data/earthquake-in-turkey.db')
# Read out the whole dataset as dataframe
histDF = pd.read_sql_query("SELECT * FROM quaketk", conn)
# Determine the last timestamp of the Historic database
cutoff_time = histDF['origintimeutc'].max()

# Subset the Realtime DF per the last record in the Historic Database
rtDF = rtDF[rtDF['origintimeutc'] > cutoff_time]

# Sort the DF to be the format of: Older datapoint to be inserted firstly
rtDF1 = rtDF.sort_values(by='origintimeutc', ascending=True)
rtDF1.reset_index(drop=True, inplace=True)

print('Mission #2 - Completed.\n')

## PART 3. Merge/Insert Realtime DF into Historic Database

print('Mission #3 - Merging Realtime Data into the Historic Database...')
# Save the dataframe to database
rtDF1.columns = ['origintimeutc', 'magnitude', 'magtype', 'latitude', 'longitude', 'depthkm', 'region', 'measmethod', 'updtime', 'attribute']
rtDF1.to_sql('quaketk', conn, if_exists='append', index=False)
# Cloe the Database
conn.close

print('Mission #3 - Completed.\n')

## PART 4. Retrieve the Whole Dataset for Export and Display

print('Mission #4 - Retrieving the Whole Dataset...')
# Create a connection to the databse
conn = sqlite3.connect('data/earthquake-in-turkey.db')
# Read out the whole dataset as dataframe
df_d = pd.read_sql_query("SELECT * FROM quaketk", conn)

print('Mission #4 - Completed.\n')

## PART 5. Data Re-treatment and Export Data Table in HTML format

print('Mission #5 - Retreating Data and Exporting Data Tables...')
# Re-treatment of the dataset
df_d['origintimeutc'] = df_d['origintimeutc'].apply(lambda x: dt.datetime.strptime(x,'%Y/%m/%d %H:%M:%S') if type(x)==str else pd.NaT)
df_d['magnitude'] = df_d['magnitude'].astype('float')
df_d['magtype'] = df_d['magtype'].astype('string')

df_d['latitude'] = df_d['latitude'].astype(str).map(lambda x: x.rstrip('° N').rstrip('° S'))
df_d['longitude'] = df_d['longitude'].astype(str).map(lambda x: x.rstrip('° E').rstrip('° W'))
df_d['depthkm'] = df_d['depthkm'].replace('-', 0).astype("float")

df_d['region'] = df_d['region'].astype('string')
df_d['measmethod'] = df_d['measmethod'].astype('string')
df_d['updtime'] = df_d['updtime'].apply(lambda x: dt.datetime.strptime(x,'%Y/%m/%d %H:%M:%S') if type(x)==str else pd.NaT)
df_d['attribute'] = df_d['attribute'].astype('string')

# Adjust datetime from UTC (GMT) to Turkey timezone (GMT+3)
df_d['eventtime'] = df_d['origintimeutc'] + pd.DateOffset(hours=3)
df_d['updtime'] = df_d['updtime'] + pd.DateOffset(hours=3)
df_d['eventtime'] = pd.to_datetime(df_d['eventtime'])
df_d['updtime'] = pd.to_datetime(df_d['updtime'])

# Create new columns for date and time
df_d['date'] = pd.to_datetime(df_d['eventtime']).dt.date
df_d['time'] = pd.to_datetime(df_d['eventtime']).dt.time

# Preapre Data for exporting to a Data Table

# Select columns
df_tbl = df_d[['eventtime', 'magnitude', 'magtype', 'latitude', 'longitude', 'depthkm', 'region', 'measmethod', 'updtime', 'attribute']]
df_tbl.columns = ['eventTime', 'magnitude', 'magType', 'latitude', 'longitude', 'depthKm', 'region', 'measMethod', 'updTime', 'attribute']
# Change the default Ascending to Descending to put newest datapoints on the top of the data table
df_tbl_1 = df_tbl.sort_values(by='eventTime', ascending=False)

# Self-making Interactive Data Table using JQuery
def generate_html(dataframe: pd.DataFrame):
    # get the table HTML from the dataframe
    table_html = dataframe.to_html(table_id="table")
    # construct the complete HTML with jQuery Data tables
    # You can disable paging or enable y scrolling on lines 20 and 21 respectively
    html = f"""
    <html>
    <header>
        <link href="https://cdn.datatables.net/1.11.5/css/jquery.dataTables.min.css" rel="stylesheet">
    </header>
    <body>
    {table_html}
    <script src="https://code.jquery.com/jquery-3.6.0.slim.min.js" integrity="sha256-u7e5khyithlIdTpu22PHhENmPcRdFiHRjhAuHcs05RI=" crossorigin="anonymous"></script>
    <script type="text/javascript" src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js"></script>
    <script>
        $(document).ready( function () {{
            $('#table').DataTable({{
                order: [[0, 'desc']],
                lengthMenu: [20, 50, 100, 200],
                pageLength: 20,
                paging: true,
            }});
        }});
    </script>
    </body>
    </html>
    """
    # return the html
    return html

# Give a go
table_interact = generate_html(df_tbl_1)
with open("output/table_interact_koeri.html", 'w') as f:
    f.write(table_interact)

# Another Pretty HTML Data Table
from pretty_html_table import build_table

html_table_bluelight = build_table(df_tbl_1, 'blue_light',
                                   font_size='medium',
                                   font_family='Arial',
                                   text_align='center',
                                   width='auto',
                                   index=False,
                                   conditions={
                                        'magnitude': {
                                        'min': 3.0,
                                        'max': 9.0,
                                        'mix_color': 'green',
                                        'max_color': 'red'
                                        }
                                   },
                                   even_color='black',
                                   even_bg_color='white'
                                   )

# center the table using HTML formatting
html_table_bluelight = '<div style="text-align:center">' + html_table_bluelight + '</div>'

# write the HTML table to a file
with open('output/table_bluelight_koeri.html', 'w') as f:
    f.write(html_table_bluelight)

print('Mission #5 - Completed.\n')

## PART 6. Generate and Export Maps

print('Mission #6 - Generating and Exporting Maps...')
## 6.1 Bubble Map
# Subset the df and rename the columns
df_d2 = df_d[['date', 'time', 'latitude', 'longitude', 'depthkm', 'magnitude', 'magtype', 'region', 'measmethod', 'eventtime', 'updtime', 'attribute']]

# Define our functions
# Func 1 - Proportionize the fill_color against magnitude
myColorScheme = ['green', 'red', 'black']
def get_color(magnitude):
    if magnitude <= 3.0:
        return myColorScheme[0]
    elif magnitude <= 6.0:
        return myColorScheme[1]
    else:
        return myColorScheme[2]

# Func 2 - addCircles
popwidth, popht = 250, 150
def addCircles(df, map):
    for x, y, mag, region, date, time in zip(df['latitude'], df['longitude'], df['magnitude'], df['region'], df['date'], df['time']):
        popUp = f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Magnitude: {mag} </strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Region: {region}</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Date: {date}</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Time: {time}</strong></span></p>"
        iframe = folium.IFrame(popUp, width=popwidth, height=popht)
        popup = folium.Popup(iframe, max_width=450)
        folium.CircleMarker(location=(x, y), radius=float(mag) * 4, weight=2, opacity=1, popup=popup,
                            color=get_color(mag), fill_color=get_color(mag), fill_opacity=0.6).add_to(map)

# Map Parameters
magThreshold = 4
mapCtr = [39.16, 35.66]

# Initial Map
bubbleMap = folium.Map(location=mapCtr, zoom_start=6, tiles=None)

# Load up the tectonic polygon (in GeoJson format)
folium.GeoJson('data/PB2002_boundaries.json', name="Tectonic Boundaries").add_to(bubbleMap)

# Add tiles with custom names (The first tile will be the default)
folium.TileLayer('Stamen Terrain', name='Terrian').add_to(bubbleMap)
folium.TileLayer('openstreetmap', name='Open Street').add_to(bubbleMap)
folium.TileLayer('Stamen Toner', name='Toner').add_to(bubbleMap)
folium.TileLayer('Stamen Water Color', name='Water Color').add_to(bubbleMap)
folium.TileLayer('cartodbdark_matter', name='Dark Matter').add_to(bubbleMap)
folium.LayerControl().add_to(bubbleMap)

# Map Data filtering
earthquakeDF = df_d2[df_d2['magnitude'].astype('float') >= magThreshold]

# add Circles (sizing per magnitude)
addCircles(earthquakeDF, bubbleMap)

# Add lenend to the bubble map

magMin, magL1, magL2, magMax = 0, 3, 6, 10
mySteps = [magMin, magL1, magL2, magMax]
# myColorScheme has been defined previously
legend_bar = StepColormap(colors=myColorScheme,
                          index=mySteps,
                          vmin=magMin, vmax=magMax,
                          tick_labels = mySteps)
legend_bar.caption = 'Magnitude Scale'
legend_bar.add_to(bubbleMap)

# More widgets
bubbleMap.add_child(folium.LatLngPopup())

# Eventually save map to interactive HTML file
bubbleMap.save("output/map_bubble_koeri.html")

## 6.2 Heat Map

# Make a list of heatMapData
heatMapData = earthquakeDF[['latitude', 'longitude', 'magnitude']]

# Create the HeatMap - "CartoDB Dark_Matter" is the default tile for heat map
heatMap = folium.Map(mapCtr, tiles="Stamen Terrain", zoom_start=6)
# More widgets
heatMap.add_child(folium.LatLngPopup())

# Create heat map
plugins.HeatMap(heatMapData, 
                name="Magnitude", 
                radius=earthquakeDF['magnitude'].mean()*3,
                min_opacity = 1,
                max_zoom=15,
                blur=20,
                overlay=False,
                control=False,
                show=True
                ).add_to(heatMap)

# Save Heatmap
heatMap.save("output/map_heat_koeri.html")

print('Mission #6 - Completed.\n')

## PART 7. Bootstrap the Landing page and Other pages
## 
## This has been done by bootstraping a very simple landing page, consisting of:
## * a Toolbar with
##    * Home
##     * Data Table
##     * Bubble Map
##     * Heat Map
##     * Project
## * a Map container, where
##     * the content shall be switched over from one to another once visitor clicks the links on the toolbar;
##     * a default page shall be loaded one the website is open.
## 
## So far, all look good.

print('All Missions Completed. Let\'s Call the day!\n')
## THE END