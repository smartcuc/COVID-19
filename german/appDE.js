const Puppeteer = require('puppeteer');
const Papa = require('papaparse');
const influx = require('influx');

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
            measurement: 'CoronaDE',
            fields: {
                Confirmed: influx.FieldType.FLOAT,
                Deaths: influx.FieldType.FLOAT,
                Recovered: influx.FieldType.FLOAT
            },
            tags: [
                'state',
                'country',
                'region'
            ],
            timestamp: influx.FieldType.Date
        }
    ]
});

const url = "https://interaktiv.morgenpost.de/corona-virus-karte-infektionen-deutschland-weltweit/";

let csvDataGermany = [];
let csvDataEurope = [];
let csvDataGlobal = [];

let tsDataGermany = [];
let tsDataEurope = [];
let tsDataGlobal = [];

let dbData = [];


async function scraeData() {

    const browser = await Puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url);

    /*---------- Germany ----------*/
    await page.click('.fnktable__expand');

    tsDataGermany = await page.evaluate(() => {
        let data = [];
        let dates = (document.getElementsByClassName('cases-display-timestamp'))[0].textContent.split(" ");

        data = dates[1].split(".");
        data.push(dates[2]);
        data[2] = data[2].substring(0, 4);
        return (data); // [Day, Month, Year, Hour]
    })


    csvDataGermany = await page.evaluate(() => {

        const tables = Array.from(
            document.querySelectorAll('div.fnktable:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > table:nth-child(1) > tbody:nth-child(3)')
        ).map(td => td.innerText);

        return tables[0].replace(/\t/g, ',').replace(/\n/g, '|').split('||');

    });

    dbData[0] = [...csvDataGermany]


    /*---------- Europe ----------*/
    await page.click('button.btn:nth-child(2)');

    tsDataEurope = await page.evaluate(() => {
        let data = [];
        let dates = (document.getElementsByClassName('cases-display-timestamp'))[0].textContent;

        data = dates.split(" ");
        return (data);
    })


    csvDataEurope = await page.evaluate(() => {
        const tables = Array.from(
            document.querySelectorAll('div.fnktable:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > table:nth-child(1) > tbody:nth-child(3)')
        ).map(td => td.innerText);

        return tables[0].replace(/\t/g, ',').replace(/\n/g, '|').split('||')
    });

    dbData[1] = [...csvDataEurope];


    /*---------- Global ----------*/
    await page.click('button.btn:nth-child(3)');

    tsDataGlobal = await page.evaluate(() => {
        let data = [];
        let dates = (document.getElementsByClassName('cases-display-timestamp'))[0].textContent;

        data = dates.split(" ");
        return (data);
    })


    csvDataGlobal = await page.evaluate(() => {
        const tables = Array.from(
            document.querySelectorAll('div.fnktable:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > table:nth-child(1) > tbody:nth-child(3)')
        ).map(td => td.innerText);

        return tables[0].replace(/\t/g, ',').replace(/\n/g, '|').split('||')

    });

    dbData[2] = [...csvDataGlobal];

    await browser.close();
}


function csvDB() {

    const series = [];
    let data = [];

    for (let i = 0; i < dbData.length; i++) {

        for (let j = 0; j < dbData[i].length; j++) {

            data = Papa.parse(dbData[i][j]).data;

            let stateDB = 'N/A';
            let countryDB = data[0][0];
            let regionDB = 'Global';

            if (i == 0) {
                stateDB = data[0][0];
                countryDB = 'Germany ';
            }

            switch (i) {

                case 0:
                    regionDB = 'Germany';
                    break;
                case 1:
                    regionDB = 'Europe';
                    break;

            }

            series.push(
                {
                    measurement: 'CoronaDE',
                    tags: {
                        state: stateDB,
                        country: countryDB,
                        region: regionDB,
                    },
                    fields: {
                        Confirmed: data[0][1].split('.').join(""),
                        Deaths: data[0][3].split('.').join(""),
                        Recovered: data[0][2].split('.').join(""),
                    },
                    timestamp: new Date(tsDataGermany[2] + '-' + tsDataGermany[1] + '-' + tsDataGermany[0] + "T" + tsDataGermany[3] + ":00:00").getTime()
                });

        }
    }
    influxdb.writeMeasurement('CoronaDE', series, { database: 'covid19', precision: 'ms' }).catch(error => {
        console.error("Error :", error, "Stack:", error.stack)
    });

}

async function getCovidGerman() {

    const result = await scraeData();
    const obj = csvDB();
}

getCovidGerman();
