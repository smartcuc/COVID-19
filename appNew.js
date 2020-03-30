const influx = require('influx');
const axios = require('axios');
const isoCode = require('./ccp.json');

const influxdb = new influx.InfluxDB({
    host: 'localhost',
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
                Population: influx.FieldType.FLOAT
            },
            tags: [
                'isocode',
                'country',
                'region'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});


function getCountryData(country) {

    let isoCodeCountry = '';

    switch (country) {
        case 'United States':
            isoCodeCountry = 'USA';
            break;

        case 'Iran':
            isoCodeCountry = 'IRN';
            break;

        case 'South Korea':
            isoCodeCountry = 'PRK';
            break;

        case 'Czech Republic':
            isoCodeCountry = 'CZE';
            break;

        case 'Russia':
            isoCodeCountry = 'RUS';
            break;

        case 'Taiwan':
            isoCodeCountry = 'TWN';
            break;

        case 'Macedonia':
            isoCodeCountry = 'MKD';
            break;

        case 'Moldova':
            isoCodeCountry = 'MDA';
            break;

        case 'Vietnam':
            isoCodeCountry = 'VNM';
            break;

        case 'Brunei':
            isoCodeCountry = 'BRN';
            break;

        case 'Venezuela':
            isoCodeCountry = 'VEN';
            break;

        case 'Ivory Coast':
            isoCodeCountry = 'CIV';
            break;

        case 'Palestine':
        case 'West Bank and Gaza':
            isoCodeCountry = 'PSE';
            break;

        case 'Bolivia':
            isoCodeCountry = 'BOL';
            break;

        case 'Congo (Kinshasa)':
            isoCodeCountry = 'COD';
            break;

        case 'Congo (Brazzaville)':
            isoCodeCountry = 'COG';
            break;

        case 'Kosovo':
            isoCodeCountry = 'XKX';
            break;

        case 'Tanzania':
            isoCodeCountry = 'TZA';
            break;

        case 'Macau':
            isoCodeCountry = 'MAC';
            break;

        case 'Burma':
            isoCodeCountry = 'MMR';
            break;

        case 'Laos':
            isoCodeCountry = 'LAO';
            break;

        case 'Vatican City':
            isoCodeCountry = 'VAT';
            break;

        case 'Cape Verde':
            isoCodeCountry = 'CPV';
            break;

        case 'Syria':
            isoCodeCountry = 'SYR';
            break;

        case 'Reunion':
            isoCodeCountry = 'REU';
            break;

        case 'St. Martin':
            isoCodeCountry = 'MAF';
            break;

        case 'Channel Islands':
            isoCodeCountry = 'CYM';
            break;

        case 'Curacao':
            isoCodeCountry = 'CUW';
            break;

        case 'East Timor':
            isoCodeCountry = 'TLS';
            break;

        case 'North Ireland':
            isoCodeCountry = 'GBR';
            break;

        case 'Saint Barthelemy':
            isoCodeCountry = 'BLM';
            break;

        case 'The Gambia':
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
            isoCodeCountry = Object.values(isoCodeCountry)[1];
            break;
    }

    let countryData = isoCode.find(cname => cname.country_code === isoCodeCountry);
    let region = "";

    if (isoCodeCountry != 'N/A') {

        population = Object.values(countryData)[2];
        region = Object.values(countryData)[3];

    } else {
        population = '0';
        region = 'N/A';
    }

    return ([isoCodeCountry, population, region]);

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

            series.push(
                {
                    measurement: 'CoronaNew',
                    tags: {
                        isocode: countryData[0],
                        country: country,
                        region: countryData[2],
                    },
                    fields: {
                        Confirmed: confirmed,
                        Deaths: deaths,
                        Recovered: recovered,
                        Population: countryData[1],
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

