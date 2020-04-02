const influx = require('influx');
const axios = require('axios');
const isoCode = require('./ccp.json');

// Define geohash precision of supplied lat/lon
const precision = 12; // set to maximum

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
            measurement: 'CoronaNew',
            fields: {
                Confirmed: influx.FieldType.FLOAT,
                Deaths: influx.FieldType.FLOAT,
                Recovered: influx.FieldType.FLOAT,
                ConfirmedNew: influx.FieldType.FLOAT,
                DeathsNew: influx.FieldType.FLOAT,
                RecoveredNew: influx.FieldType.FLOAT,
                Population: influx.FieldType.FLOAT
            },
            tags: [
                'isocode_2',
                'isocode',
                'latitude',
                'longitude',
                'geohash',
                'country',
                'region'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});


function getGeoHash(lat, lon) {

    const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

    let idx = 0; // index into base32 map
    let bit = 0; // each char holds 5 bits
    let evenBit = true;
    let geohash = '';

    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;

    while (geohash.length < precision) {
        if (evenBit) {
            // bisect E-W longitude
            const lonMid = (lonMin + lonMax) / 2;
            if (lon >= lonMid) {
                idx = idx * 2 + 1;
                lonMin = lonMid;
            } else {
                idx = idx * 2;
                lonMax = lonMid;
            }
        } else {
            // bisect N-S latitude
            const latMid = (latMin + latMax) / 2;
            if (lat >= latMid) {
                idx = idx * 2 + 1;
                latMin = latMid;
            } else {
                idx = idx * 2;
                latMax = latMid;
            }
        }
        evenBit = !evenBit;

        if (++bit == 5) {
            // 5 bits gives us a character: append it and start over
            geohash += base32.charAt(idx);
            bit = 0;
            idx = 0;
        }
    }

    return geohash;

}

function getCountryData(country) {

    let isoCode_2, isoCodeCountry, geoHash = '';
    let lat, long, population = 0;

    switch (country) {
        case 'United States':
            isoCodeCountry = 'USA';
            break;

        case 'South Korea':
            isoCodeCountry = 'PRK';
            break;

        case 'Russia':
            isoCodeCountry = 'RUS';
            break;

        case 'Macedonia':
            isoCodeCountry = 'MKD';
            break;

        case 'Moldova':
            isoCodeCountry = 'MDA';
            break;

        case 'Brunei':
            isoCodeCountry = 'BRN';
            break;

        case 'Ivory Coast':
            isoCodeCountry = 'CIV';
            break;

        case 'Palestine':
        case 'West Bank and Gaza':
            isoCodeCountry = 'PSE';
            break;

        case 'Congo (Kinshasa)':
            isoCodeCountry = 'COD';
            break;

        case 'Congo (Brazzaville)':
            isoCodeCountry = 'COG';
            break;

        case 'Burma':
            isoCodeCountry = 'MMR';
            break;

        case 'Cape Verde':
            isoCodeCountry = 'CPV';
            break;

        case 'St. Martin':
            isoCodeCountry = 'MAF';
            break;

        case 'Channel Islands':
            isoCodeCountry = 'CYM';
            break;

        case 'East Timor':
            isoCodeCountry = 'TLS';
            break;

        case 'North Ireland':
            isoCodeCountry = 'GBR';
            break;

        case "The Gambia":
        case 'Gambia':
            isoCodeCountry = 'GMB';
            break;

        case 'MS Zaandam':
        case 'Others':
        case 'Diamond Princess':
        case 'Cruise Ship':
            isoCodeCountry = 'N/A';
            break;

        default:
            isoCodeCountry = isoCode.find(cname => cname.country_name === country);
            isoCodeCountry = Object.values(isoCodeCountry)[2];
            break;
    }

    let countryData = isoCode.find(cname => cname.country_code_3 === isoCodeCountry);
    let region = "";

    if (isoCodeCountry != 'N/A') {

        isoCode_2 = Object.values(countryData)[1];
        lat = Object.values(countryData)[3];
        long = Object.values(countryData)[4];
        region = Object.values(countryData)[5];
        population = Object.values(countryData)[6];
        geoHash = getGeoHash(lat, long);

    } else {
        isoCode_2 = 'N/A';
        lat = 0;
        long = 0;
        geoHash = 'N/A';
        population = 0;
        region = 'N/A';
    }

    return ([country, isoCode_2, isoCodeCountry, lat, long, geoHash, region, population]);

}


function getCovidData() {

    const url = "https://coviddata.github.io/coviddata/v1/countries/stats.json";

    return axios.get(url);
}


async function getCovid() {

    const covidDaten = await getCovidData();

    return covidDaten.data;

}


async function Covid() {

    const series = [];
    const result = await getCovid();

    for (let i = 0; i < result.length; i++) {

        const country = Object.values(result[i].country)[1];
        const countryData = getCountryData(country);

        for (let j = 0; j < Object.values(result[i].dates).length; j++) {

            const timestemp = new Date(Object.keys(result[i].dates)[j]).getTime() + (2 * 3600 * 1000);
            const confirmed = Object.values(result[i].dates)[j].cumulative.cases;
            const deaths = Object.values(result[i].dates)[j].cumulative.deaths;
            const recovered = Object.values(result[i].dates)[j].cumulative.recoveries;

            const confirmedNew = Object.values(result[i].dates)[j].new.cases;
            const deathsfNew = Object.values(result[i].dates)[j].new.deaths;
            const recoveredNew = Object.values(result[i].dates)[j].new.recoveries;

            series.push(
                {
                    measurement: 'CoronaNew',
                    tags: {
                        isocode_2: countryData[1],
                        isocode: countryData[2],
                        latitude: countryData[3],
                        longitude: countryData[4],
                        geohash: countryData[5],
                        country: country,
                        region: countryData[6],
                    },
                    fields: {
                        Confirmed: confirmed,
                        Deaths: deaths,
                        Recovered: recovered,
                        ConfirmedNew: confirmedNew,
                        DeathsNew: deathsfNew,
                        RecoveredNew: recoveredNew,
                        Population: countryData[7],
                    },
                    timestamp: timestemp
                });


        }


    }

    influxdb.writeMeasurement('CoronaNew', series, { database: 'covid19', precision: 'ms' }).catch(error => {
        console.error("Error :", error, "Stack:", error.stack)
    });

}


Covid();

