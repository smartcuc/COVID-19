# COVID-19
Download, convert and load COVID-19 information into influxdb.
This "app" will load the CSV of Covid-19 and convert them for loading into an influxDB.
As the source is being updated once a day, you should run this app three times a day.
In addition, I would recommend using appNew.js. The reason for that is the issue with the recovered figures from JHU.

# Update 04 April 2020
Clean up and adding fields of appNew.js and ccp.json. The db structure has been extended by daily new conformed, deaths, and recovered as well added ISO 3166 alpha-2, lat, long, and geohash.

fields:

  Confirmed, Deaths, Recovered, ConfirmedNew, DeathsNew, RecoveredNew, Population
  
tags:

  isocode_2, 'isocode, latitude, longitude, geohash, country, region
            

Grafana Dashboard Export.

Zoom 50%

Overview:
![Image Overview](https://raw.githubusercontent.com/smartcuc/COVID-19/master/Dashboards/Overview.PNG)

View per Country:
![Image View per Country](https://github.com/smartcuc/COVID-19/blob/master/Dashboards/Per_Country.PNG)

# Stay safe and keep healthy - Ruediger

## Use Docker container

### Build your own image

```shell
docker build -t covid-19-influxdb https://github.com/smartcuc/COVID-19.git
```

### Start container

#### With your own build

```shell
docker run --name covid-19 -e "INFLUX_HOST=infludb.host" covid-19-influxdb
```

#### With Docker hub image

```shell
docker run --name covid-19 -e "INFLUX_HOST=infludb.host" verbalinsurection/covid-19-influxdb
```

### Available environment variable

* INFLUX_HOST: [Mandatory] Influxdb host address
* INFLUX_USER: [Optionnal] User for Influxdb
* INFLUX_PASS: [Optionnal] Password for Influxdb
* SCHEDULE_H: [Optionnal] Schedule the datas update of the data. Without it, will run once.
