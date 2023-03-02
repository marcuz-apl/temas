import pandas as pd
from webScrapping import toDF
import folium
import webbrowser

pd.set_option('display.width', 340)
pd.set_option('display.max_columns', 8)
earthquakeDF = toDF()

# Limiting the output to earthquake magnitude >=3.5 only
earthquakeDF = earthquakeDF[earthquakeDF['Magnitude [ML]'].astype('float') >= 3.5]

print(earthquakeDF.to_string())

earthquakeMap = folium.Map(location=[39.16, 35.66], zoom_start=5.5, tiles="Stamen Terrain")
# Original URL was - https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json

folium.GeoJson('data/PB2002_boundaries.json', name="geojson").add_to(earthquakeMap)
folium.TileLayer('Stamen Terrain').add_to(earthquakeMap)
folium.TileLayer('Stamen Toner').add_to(earthquakeMap)
folium.TileLayer('Stamen Water Color').add_to(earthquakeMap)
folium.TileLayer('cartodbpositron').add_to(earthquakeMap)
folium.TileLayer('cartodbdark_matter').add_to(earthquakeMap)
folium.LayerControl().add_to(earthquakeMap)

def addCircles(df, map):
    for x, y, z, *a in zip(df['Latitude'], df['Longitude'], df['Magnitude [ML]'], df['Location'], df['Date'], df['Time']):
        popUp = f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Magnitude : {z} ML&nbsp;</strong></span></p>" \
                f"<p style='text-align: center;'><span style='font-family: Verdana, Geneva, sans-serif; font-size: 12px; color: rgb(40, 50, 78);'><strong>Location - Date: {a}</strong></span></p>"
        iframe = folium.IFrame(popUp, width=450, height=70)
        popup = folium.Popup(iframe, max_width=450)
        folium.CircleMarker(location=(x, y), radius=float(z) * 4, weight=2, opacity=1, popup=popup,
                            color="red", fill_color="red", fill_opacity=0.1).add_to(map)

addCircles(earthquakeDF, earthquakeMap)

#earthquakeMap

earthquakeMap.save("map.html")
webbrowser.open("map.html")
