const papa = require('papaparse');
const influx = require('influx');
const axios = require('axios');

const HttpsProxyAgent = require('https-proxy-agent');
const axiosDefaultConfig = {
    proxy: false,
    httpsAgent: new HttpsProxyAgent('http://XXXX:XXXX@XXXX:XXXX')
};

// Get INFLUX_HOST environment variable
const influxhost = process.env.INFLUX_HOST || 'localhost';

const influxdb = new influx.InfluxDB({
    host: influxhost,
    port: 8086,
    database: 'covid19',
    pool: {
        maxRetries: 5,
        requestTimeout: 600000,
    },
    schema: [
        {
            measurement: 'Corona',
            fields: {
                Confirmed: influx.FieldType.FLOAT,
                Deaths: influx.FieldType.FLOAT,
                Recovered: influx.FieldType.FLOAT
            },
            tags: [
                'state',
                'country',
                'lat',
                'long'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});


const statType = ['Confirmed', 'Deaths', 'Recovered'];

let covidConfirmed;
let covidDeaths;
let covidRecovered;

function getCovidData(item) {

    const url = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_" + item.toLowerCase() + "_global.csv";

    return axios.get(url);
}


function convertHeader(convDaten) {

    var parseMe = papa.parse(convDaten, {
        delimiter: ",",
        header: true,
        dynamicTyping: true,

        transformHeader: function (header) {
            switch (header) {
                case "Province/State":
                case "Country/Region":
                case "Lat":
                case "Long":
                    break;
                default: {
                    header = new Date(header).getTime();
                    header = header + (2 * 3600 * 1000);
                }
            }

            return (header)
        }
    });

    return (parseMe.data)

}



async function getCovid() {

    for (let i = 0; i < statType.length; i++) {

        const covidDaten = await getCovidData(statType[i]);

        switch (statType[i]) {
            case 'Confirmed':
                covidConfirmed = convertHeader(covidDaten.data);
                prepDB(covidConfirmed, 'Confirmed');
                break;

            case 'Deaths':
                covidDeaths = convertHeader(covidDaten.data);
                prepDB(covidDeaths, 'Deaths');
                break;

            case 'Recovered':
                covidRecovered = convertHeader(covidDaten.data);
                prepDB(covidRecovered, 'Recovered');
                break;

            default:
                break;

        }

    }

}

function prepDB(covidDatenPrep, type) {

    const series = [];
    const countLines = Object.keys(covidDatenPrep).length;
    const countRows = Object.keys(Object.keys(covidDatenPrep[0])).length;

    for (let i = 0; i < countLines - 1; i++) {

        const line = Object.entries(covidDatenPrep[i]);

        let state = line[0][1];
        let country = line[1][1];
        let lat = line[2][1];
        let long = line[3][1];

        if (state == null) {
            state = "N/A";
        }

        for (let j = 4; j < countRows; j++) {

            let lineItem = Object.values(line[j])
            let timestemp = lineItem[0];
            let lineCount = lineItem[1];

            series.push(
                {
                    measurement: 'Corona',
                    tags: {
                        state: state,
                        country: country,
                        lat: lat,
                        long: long
                    },
                    fields: {
                        [type]: lineCount,

                    },
                    timestamp: timestemp
                });

        }

    };

    influxdb.writeMeasurement('Corona', series, { database: 'covid19', precision: 'ms' }).catch(error => {
        console.error("Error :", error, "Stack:", error.stack)
    });

}


async function Covid() {

    const result = await getCovid();

}


Covid();
