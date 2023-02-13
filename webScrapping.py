import pandas as pd
import requests
from bs4 import BeautifulSoup

url = "http://www.koeri.boun.edu.tr/scripts/lst0.asp"
r = requests.get(url)
soup = BeautifulSoup(r.content, "html.parser")

table = str(soup.find('pre'))
lines = table.splitlines()[7:507:]


def toDF():
    earthquakeDF = pd.DataFrame(
        columns=["Date", "Time", "Latitude", "Longitude", "Depth [km]", "Magnitude [ML]", "Location", "Attribute"])
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
        location = str()
        if len(item) == 10:
            location = item[len(item) - 2]
        else:
            for i in (item[8:len(item) - 1]):
                location = location + i + " "
        new_row = {"Date": [date], "Time": [time], "Latitude": [lat], "Longitude": [long], "Depth [km]": [depth],
                   "Magnitude [ML]": [mag], "Location": [location], "Attribute": [att]}
        #earthquakeDF = earthquakeDF.append(new_row, ignore_index=True) -- append method is to be depreciated.
        earthquakeDF = pd.concat([earthquakeDF, pd.DataFrame.from_dict(new_row)])
    return earthquakeDF
