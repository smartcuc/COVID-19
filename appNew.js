const influx = require('influx');
const axios = require('axios');
const isoCode = require('./ccp.json');

// Define geohash precision of supplied lat/lon
const precision = 12; // set to maximum

// Get INFLUX_HOST environment variable
const scheduleH = process.env.SCHEDULE_H || 0;
const influxhost = process.env.INFLUX_HOST || 'localhost';
const influxUser = process.env.INFLUX_USER;
const influxPass = process.env.INFLUX_PASS;

const influxdb = new influx.InfluxDB({
    host: influxhost,
    username: influxUser,
    password: influxPass,
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
                // Recovered: influx.FieldType.FLOAT,
                ConfirmedNew: influx.FieldType.FLOAT,
                DeathsNew: influx.FieldType.FLOAT,
                // RecoveredNew: influx.FieldType.FLOAT,
                Population: influx.FieldType.FLOAT,
                Vaccinated: influx.FieldType.FLOAT,
                VaccinatedNew: influx.FieldType.FLOAT,
                ReproductionRate: influx.FieldType.FLOAT,
                HospPatients: influx.FieldType.FLOAT,
                IcuPatients: influx.FieldType.FLOAT
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
            if (!isoCodeCountry) {
                isoCodeCountry = 'N/A';
            } else {
                isoCodeCountry = Object.values(isoCodeCountry)[2];
            }
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

    // const url = "https://coviddata.github.io/coviddata/v1/countries/stats.json";
    const url = "https://covid.ourworldindata.org/data/owid-covid-data.json";

    return axios.get(url);
}


async function getCovid() {

    const covidDaten = await getCovidData();

    return covidDaten.data;

}


async function Covid() {
    console.log(new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
        + ' - Running update');
    
    const series = [];
    const result = await getCovid();
    for (var countKey in result) {
        const country = result[countKey].location;
        try {
            const countryData = getCountryData(country);
            if (countryData[1] != 'N/A') {
                for (var dataKey in result[countKey]['data']) {
                    const timestemp = new Date(result[countKey]['data'][dataKey].date).getTime() + (2 * 3600 * 1000);
                    const confirmed = result[countKey]['data'][dataKey].total_cases;
                    const deaths = result[countKey]['data'][dataKey].total_deaths;
                    // const recovered = result[countKey]['data'][dataKey].;
                    const confirmedNew = result[countKey]['data'][dataKey].new_cases;
                    const deathsfNew = result[countKey]['data'][dataKey].new_deaths;
                    const peopleVaccinated = result[countKey]['data'][dataKey].people_vaccinated;
                    const newVaccinations = result[countKey]['data'][dataKey].new_vaccinations;
                    const reproductionRate = result[countKey]['data'][dataKey].reproduction_rate;
                    const hospPatients = result[countKey]['data'][dataKey].hosp_patients;
                    const icuPatients = result[countKey]['data'][dataKey].icu_patients;
                    // const recoveredNew = result[countKey]['data'][dataKey].;

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
                                // Recovered: recovered,
                                ConfirmedNew: confirmedNew,
                                DeathsNew: deathsfNew,
                                // RecoveredNew: recoveredNew,
                                Population: countryData[7],
                                Vaccinated: peopleVaccinated,
                                VaccinatedNew: newVaccinations,
                                ReproductionRate: reproductionRate,
                                HospPatients: hospPatients,
                                IcuPatients: icuPatients,
                            },
                            timestamp: timestemp
                        });
                }
            }
        } catch (error) {
              console.error(error);
        }
    }

    influxdb.writeMeasurement('CoronaNew', series, { database: 'covid19', precision: 'ms' }).catch(error => {
        console.error("Error :", error, "Stack:", error.stack)
    });

}


Covid();

if (scheduleH != 0) {
    console.log('Entering schedule update mode, hours: ' + scheduleH);
    setInterval(Covid, scheduleH * 3600000);
}
