# Load up a few Libraries
import os
import pandas as pd
import folium
import requests
from bs4 import BeautifulSoup
import webbrowser

# Data source - last 500 events only
url = "http://www.koeri.boun.edu.tr/scripts/lasteq.asp" # lasteq.asp coresponds to the English version
r = requests.get(url)
soup = BeautifulSoup(r.content, "html.parser")

table = str(soup.find('pre'))
lines = table.splitlines()[7:507:]

# Function to convert table in the url to a dataframe
def tbl2df(lines):
    df = pd.DataFrame(
        columns=["Date", "Time", "Latitude", "Longitude", "Depth_km", "Magnitude", "Region", "Attribute"])
    line = list()
    for item in lines:
        line.append(item.split())
    for item in line:
        date = item[0]
        time = item[1]
        lat = float(item[2])
        long = float(item[3])
        depth = format(float(item[4]), ".1f")
        mag = format(float(item[6]), ".1f")
        att = item[len(item) - 1]
        region = str()
        if len(item) == 10:
            region = item[len(item) - 2]
        else:
            for i in (item[8:len(item) - 1]):
                region = region + i + " "
        new_row = {"Date": [date], "Time": [time], "Latitude": [lat], "Longitude": [long], "Depth_km": [depth],
                   "Magnitude": [mag], "Region": [region], "Attribute": [att]}
        df = pd.concat([df, pd.DataFrame.from_dict(new_row)])
    return df

# Table to Dataframe
earthquakeDF = tbl2df(lines)

# Pandas display settings - not a must-have though
pd.set_option('display.width', 340)
pd.set_option('display.max_columns', 8)

# Limiting the output to earthquake magnitude >=3.5 only
earthquakeDF = earthquakeDF[earthquakeDF['Magnitude'].astype('float') >= 3.5]

print(earthquakeDF.to_string())

earthquakeMap = folium.Map(location=[39.2, 35.6], zoom_start=5, tiles="Stamen Terrain")

# Add the boundary in (Geojson file format)
# Original URL was - https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json
folium.GeoJson('data/PB2002_boundaries.json', name="geojson").add_to(earthquakeMap)

# Add several tiles
folium.TileLayer('Stamen Terrain').add_to(earthquakeMap)
folium.TileLayer('Stamen Toner').add_to(earthquakeMap)
folium.TileLayer('Stamen Water Color').add_to(earthquakeMap)
folium.TileLayer('cartodbpositron').add_to(earthquakeMap)
folium.TileLayer('cartodbdark_matter').add_to(earthquakeMap)
folium.LayerControl().add_to(earthquakeMap)

# Function to add Circles with iframe-based popups
def addCircles(df, map):
    for x, y, z, loc, date, time in zip(df['Latitude'], df['Longitude'], df['Magnitude'], df['Region'], df['Date'], df['Time']):
        popUp = f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Magnitude: {z} ML&nbsp;</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Location: {loc}</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Date: {date}</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Time: {time}</strong></span></p>"
        iframe = folium.IFrame(popUp, width=250, height=150)
        popup = folium.Popup(iframe, max_width=450)
        folium.CircleMarker(location=(x, y), radius=float(z) * 4, weight=2, opacity=1, popup=popup,
                            color="red", fill_color="red", fill_opacity=0.1).add_to(map)

# Call the function to add circles
addCircles(earthquakeDF, earthquakeMap)

# Save earthquakeMap to a HTML file and display it.
earthquakeMap.save("output/map_lasteq.html")
webbrowser.open(os.getcwd() + "../output/map_lasteq.html")

# The End