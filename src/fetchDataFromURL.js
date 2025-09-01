"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const he = require("he");
const { createOrUpdateObject } = require("./createOrUpdateObject");
const { getTranslation } = require("./getTranslation");

/**
 * Fetches the content of a web page from the specified url.
 * @param {string} url - The url of the web page to fetch.
 * @returns {Promise<string>} - A promise that resolves with the HTML content of the page.
 */
async function fetchWebPage(url) {
    const response = await axios.get(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (compatible; ioBroker.wetteronline; +https://github.com/3x3cut0r/ioBroker.wetteronline)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
            Referer: "https://www.wetteronline.de/",
        },
    });
    return response.data;
}

/**
 * Converts specific values ("-999", undefined, null, or empty string) to 0 or null.
 * @param {number|string|null} value - The value to convert.
 * @returns {number|string|null} - 0 if the value is "-999", undefined, null, or empty string; otherwise, the integer value.
 */
function convertEmpty(value, returnNull = false) {
    if (value === undefined || value === null) {
        return returnNull ? null : 0;
    }
    if (typeof value === "number" && value === -999) {
        return returnNull ? null : 0;
    }
    if (typeof value === "string" && (value.trim() === "-999" || value.trim() === "")) {
        return returnNull ? null : 0;
    }
    return value;
}

/**
 * Decodes HTML entities in a string.
 * @param {string} htmlString - The HTML string to decode.
 * @returns {string} - The decoded HTML string.
 */
function decodeHtmlEntities(htmlString) {
    return he.decode(htmlString);
}

/**
 * Store the city name from the HTML content as object.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchCity(adapter, $) {
    // Find and store value
    const headline = $("#nowcast-card-headline").text().trim();
    const cityMatch = headline.match(/Wetter\s+(.*)/i); // Matches "Wetter [City]"
    const value = cityMatch ? cityMatch[1].trim() : null;

    // Create the object
    await createOrUpdateObject(adapter, "city", value);
}

/**
 * Extracts the temperature value from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchTemperature(adapter, $) {
    // Find and store value
    const tempText = $("#nowcast-card-temperature .value").text().trim();
    const temperature = parseInt(tempText, 10);
    const value = isNaN(temperature) ? null : temperature;

    // Define object options
    const options = {
        common: {
            type: "number",
            role: "value.temperature",
            unit: "°C",
        },
    };

    // Create the object
    await createOrUpdateObject(adapter, "forecast.current.temperature", value, options);
}

/**
 * Convert a HH:MM time string to an ISO timestamp for today.
 * @param adapter - The ioBroker adapter instance
 * @param {string} timeString - Time in HH:MM format
 * @param {string} label - Label for warning messages
 * @returns {string|null} ISO timestamp or null if invalid
 */
function parseTimeToISO(adapter, timeString, label) {
    if (timeString && /^\d{1,2}:\d{2}$/.test(timeString)) {
        const [hours, minutes] = timeString.split(":").map((v) => parseInt(v, 10));
        if (
            !isNaN(hours) &&
            !isNaN(minutes) &&
            hours >= 0 &&
            hours < 24 &&
            minutes >= 0 &&
            minutes < 60
        ) {
            const now = new Date();
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        }
        adapter.log.warn(`Invalid ${label} time received: ${timeString}`);
    } else if (timeString) {
        adapter.log.warn(`Invalid ${label} time received: ${timeString}`);
    }
    return null;
}

/**
 * Extracts the sunrise time from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchSunrise(adapter, $) {
    // Find and store value
    const sunrise = $("#sunrise-sunset-today #sunrise").text().trim();
    const value = parseTimeToISO(adapter, sunrise, "sunrise");

    // Define object options
    const options = {
        common: {
            role: "date.sunrise",
        },
    };

    // Create the object
    await createOrUpdateObject(adapter, "forecast.current.sunrise", value, options);
}

/**
 * Extracts the sunset time from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchSunset(adapter, $) {
    // Find and store value
    const sunset = $("#sunrise-sunset-today #sunset").text().trim();
    const value = parseTimeToISO(adapter, sunset, "sunset");

    // Define object options
    const options = {
        common: {
            role: "date.sunset",
        },
    };

    // Create the object
    await createOrUpdateObject(adapter, "forecast.current.sunset", value, options);
}

/**
 * Extracts forecast data (min, max, sun teaser, and precipitation teaser) from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchForecastData(adapter, $) {
    // Find and store forecast data
    const forecastData = {};
    let daytimeCounter = 0;

    // Loop through each day column in the forecast table
    const rows = $("#forecasttable #weather tbody tr").toArray();
    for (const row of rows) {
        const rowType = $(row).attr("class");

        // Maximum temperature
        if (rowType === "Maximum Temperature") {
            const cells = $(row).find("td").toArray();
            cells.forEach((cell, dayIndex) => {
                const dayKey = `${dayIndex}d`;
                if (!forecastData[dayKey]) forecastData[dayKey] = {};
                const maxTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                forecastData[dayKey].temperatureMax = isNaN(maxTemp) ? null : maxTemp;
            });
        }

        // Minimum temperature
        if (rowType === "Minimum Temperature") {
            const cells = $(row).find("td").toArray();
            cells.forEach((cell, dayIndex) => {
                const dayKey = `${dayIndex}d`;
                if (!forecastData[dayKey]) forecastData[dayKey] = {};
                const minTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                forecastData[dayKey].temperatureMin = isNaN(minTemp) ? null : minTemp;
            });
        }

        // Sun hours
        if ($(row).attr("id") === "sun_teaser") {
            const cells = $(row).find("td span").toArray();
            cells.forEach((cell, dayIndex) => {
                const dayKey = `${dayIndex}d`;
                if (!forecastData[dayKey]) forecastData[dayKey] = {};
                const sunTeaser = parseInt($(cell).text().replace("Std.", "").trim(), 10);
                forecastData[dayKey].sun = isNaN(sunTeaser) ? null : sunTeaser;
            });
        }

        // Probability of precipitation
        if ($(row).attr("id") === "precipitation_teaser") {
            const cells = $(row).find("td span").toArray();
            cells.forEach((cell, dayIndex) => {
                const dayKey = `${dayIndex}d`;
                if (!forecastData[dayKey]) forecastData[dayKey] = {};
                const precipitationTeaser = parseInt($(cell).text().replace("%", "").trim(), 10);
                forecastData[dayKey].precipitation = isNaN(precipitationTeaser) ? null : precipitationTeaser;
            });
        }

        // daytime0-3 (Morning, Afternoon, Evening, Night)
        if (rowType === "symbol") {
            const daytimeIndex = daytimeCounter++;
            const cells = $(row).find("td").toArray();
            for (const [dayIndex, cell] of cells.entries()) {
                // Read the data-tt-args attribute
                const dataAttr = $(cell).attr("data-tt-args");
                if (!dataAttr) continue;

                // Parse the data-tt-args list values
                const values = decodeHtmlEntities(dataAttr.replace(/\[|\]|"/g, "")).split(",");

                // Parse objects
                const precipitation = convertEmpty(parseInt(values[4], 10)); // Field 4
                const windGustsBft = convertEmpty(String(values[6])); // Field 6
                const windGustsKmh = convertEmpty(parseInt(values[7], 10)); // Field 7
                const windSpeedText = convertEmpty(String(values[13]), true); // Field 13
                const windDirection = convertEmpty(String(values[14]), true); // Field 14
                const windSpeedKmh = convertEmpty(parseInt(values[15], 10)); // Field 15
                const windSpeedBft = convertEmpty(String(values[16])); // Field 16
                const temperature = convertEmpty(parseInt(values[17], 10), true); // Field 17
                const temperatureFeelslike = convertEmpty(parseInt(values[18], 10), true); // Field 18
                const windDirectionShortSector = convertEmpty(String(values[20]), true); // Field 20

                // Build the day key (0d, 1d, 2d, 3d)
                const dayKey = `${dayIndex}d`;
                if (!forecastData[dayKey]) {
                    forecastData[dayKey] = {};
                }

                // Build the daytime keys (0dt, 1dt, 2dt, 3dt)
                const daytimeKey = `${daytimeIndex}dt`;
                if (!forecastData[dayKey][daytimeKey]) {
                    forecastData[dayKey][daytimeKey] = {};
                }

                // Store the values
                forecastData[dayKey][daytimeKey].precipitation = precipitation;
                forecastData[dayKey][daytimeKey].windGustsBft = await getTranslation(adapter, String(windGustsBft));
                forecastData[dayKey][daytimeKey].windGustsKmh = windGustsKmh;
                forecastData[dayKey][daytimeKey].windSpeedText = await getTranslation(adapter, String(windSpeedText));
                forecastData[dayKey][daytimeKey].windDirection = await getTranslation(adapter, String(windDirection));
                forecastData[dayKey][daytimeKey].windSpeedKmh = windSpeedKmh;
                forecastData[dayKey][daytimeKey].windSpeedBft = await getTranslation(adapter, String(windSpeedBft));
                forecastData[dayKey][daytimeKey].temperature = temperature;
                forecastData[dayKey][daytimeKey].temperatureFeelslike = temperatureFeelslike;
                forecastData[dayKey][daytimeKey].windDirectionShortSector = await getTranslation(
                    adapter,
                    String(windDirectionShortSector),
                );
            }
        }
    }

    // Store forecast data
    for (const [day, values] of Object.entries(forecastData)) {
        const dayNumber = `${day.replace(/^day/, "")}`;

        for (const [key, value] of Object.entries(values)) {
            if (key.endsWith("dt")) {
                const daytime = key;
                const daytimeValues = value;

                // Store daytimes
                for (const [key, value] of Object.entries(daytimeValues)) {
                    let type = "number";
                    let role = "value";
                    let unit = "";

                    switch (key) {
                        case "precipitation":
                            if (daytime === "0dt" || daytime === "1dt") {
                                role = `value.precipitation.day.forecast.${dayNumber}`;
                            } else {
                                role = `value.precipitation.night.forecast.${dayNumber}`;
                            }
                            unit = "%";
                            break;
                        case "windGustsBft":
                            type = "string";
                            role = `value.speed.wind.gust`;
                            unit = "Bft";
                            break;
                        case "windGustsKmh":
                            role = `value.speed.wind.gust`;
                            unit = "km/h";
                            break;
                        case "windSpeedText":
                        case "windDirection":
                            type = "string";
                            role = `weather.direction.wind.forecast.${dayNumber}`;
                            break;
                        case "windSpeedKmh":
                            role = `value.speed.wind.forecast.${dayNumber}`;
                            unit = "km/h";
                            break;
                        case "windSpeedBft":
                            type = "string";
                            role = `value.speed.wind.forecast.${dayNumber}`;
                            unit = "Bft";
                            break;
                        case "temperature":
                            role = `value.temperature.forecast.${dayNumber}`;
                            unit = "°C";
                            break;
                        case "temperatureFeelslike":
                            role = `value.temperature.feelslike.forecast.${dayNumber}`;
                            unit = "°C";
                            break;
                        case "windDirectionShortSector":
                            type = "string";
                            role = `weather.direction.wind`;
                            break;
                    }

                    // Define object options
                    const options = {
                        common: {
                            type: type,
                            role: role,
                            unit: unit,
                        },
                    };

                    // Create the object
                    await createOrUpdateObject(adapter, `forecast.${day}.${daytime}.${key}`, value, options);
                }
            } else {
                // Store current values based on key
                let role = "value";
                let unit = "";

                switch (key) {
                    case "temperatureMax":
                        role = `value.temperature.max.forecast.${dayNumber}`;
                        unit = "°C";
                        break;
                    case "temperatureMin":
                        role = `value.temperature.min.forecast.${dayNumber}`;
                        unit = "°C";
                        break;
                    case "precipitation":
                        role = `value.precipitation.forecast.${dayNumber}`;
                        unit = "%";
                        break;
                    case "sun":
                        role = "value.sun";
                        unit = "h";
                        break;
                }

                // Define object options
                const options = {
                    common: {
                        type: "number",
                        role: role,
                        unit: unit,
                    },
                };

                // Create the object
                await createOrUpdateObject(adapter, `forecast.${day}.${key}`, value, options);
            }
        }
    }
}

/**
 * Extracts hourly forecast data from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchHourlyForecastData(adapter, $) {
    const hourlyForecastData = {};
    const hourlyData = [];

    // Extract all <script> tags inside the hourly container
    const scripts = $("#hourly-container script").get();
    scripts.forEach((script) => {
        const scriptContent = $(script).html();
        const hourlyDataMatch = scriptContent.match(
            /WO\.metadata\.p_city_weather\.hourlyForecastElements\.push\(([\s\S]*?)\);/g,
        );

        if (hourlyDataMatch) {
            hourlyDataMatch.forEach((dataEntry) => {
                const jsonData = dataEntry.match(/push\(([\s\S]*?)\);/);
                if (jsonData && jsonData[1]) {
                    try {
                        const dataObj = decodeHtmlEntities(jsonData[1]).replace(
                            /([{,]\s*)([A-Za-z0-9_]+)\s*:/g,
                            '$1"$2":',
                        );
                        const parsedData = JSON.parse(dataObj);
                        hourlyData.push(parsedData);
                    } catch (error) {
                        adapter.log.warn(`Failed to parse hourly data: ${error.message}`);
                    }
                }
            });
        }
    });

    // Process each hour's data
    for (const [index, data] of hourlyData.entries()) {
        // Parse objects
        const apparentTemperature = convertEmpty(parseInt(data.apparentTemperature, 10));
        const daySynonym = convertEmpty(String(data.daySynonym));
        const dayTime = convertEmpty(String(data.dayTime));
        const docrootVersion = convertEmpty(String(data.docrootVersion));
        const freshSnowDepth = convertEmpty(parseInt(data.freshSnowDepth, 10));
        const hour = convertEmpty(parseInt(data.hour, 10));
        const hourlyPrecipitationAmount = convertEmpty(String(data.hourlyPrecipitationAmount));
        const hourlyPrecipitationDuration = convertEmpty(parseInt(data.hourlyPrecipitationDuration, 10));
        const precipitationProbability = convertEmpty(parseInt(data.precipitationProbability, 10));
        const smog = convertEmpty(parseInt(data.smog, 10));
        const snowProbability = convertEmpty(parseInt(data.snowProbability, 10));
        const symbol = convertEmpty(String(data.symbol));
        const symbolText = convertEmpty(String(data.symbolText));
        const temperature = convertEmpty(parseInt(data.temperature, 10));
        const thunderstormProbability = convertEmpty(parseInt(data.thunderstormProbability, 10));
        const tierAppendix = convertEmpty(parseInt(data.tierAppendix, 10));
        const umbrellaState = convertEmpty(String(data.umbrellaState));
        const weatherInfoIndex = convertEmpty(parseInt(data.weatherInfoIndex, 10));
        const windDirection = convertEmpty(String(data.windDirection));
        const windDirectionShortSector = convertEmpty(String(data.windDirectionShortSector));
        const windGusts = convertEmpty(parseInt(data.windGusts, 10));
        const windGustsKmh = convertEmpty(parseInt(data.windGustsKmh, 10));
        const windSpeedBft = convertEmpty(String(data.windSpeedBft));
        const windSpeedKmh = convertEmpty(parseInt(data.windSpeedKmh, 10));
        const windSpeedText = convertEmpty(String(data.windSpeedText));
        const windy = convertEmpty(String(data.windy));
        const airPressure = convertEmpty(parseInt(data.airPressure, 10));
        const humidity = convertEmpty(parseInt(data.humidity, 10));

        // Build the hour key (0h, 1h, 2h, 3h, ...)
        const hourKey = `${index}h`;
        if (!hourlyForecastData[hourKey]) {
            hourlyForecastData[hourKey] = {};
        }

        // Store the values
        hourlyForecastData[hourKey]["apparentTemperature"] = apparentTemperature;
        hourlyForecastData[hourKey]["daySynonym"] = await getTranslation(adapter, String(daySynonym));
        hourlyForecastData[hourKey]["dayTime"] = await getTranslation(adapter, String(dayTime));
        hourlyForecastData[hourKey]["docrootVersion"] = await getTranslation(adapter, String(docrootVersion));
        hourlyForecastData[hourKey]["freshSnowDepth"] = freshSnowDepth;
        hourlyForecastData[hourKey]["hour"] = hour;
        hourlyForecastData[hourKey]["hourlyPrecipitationAmount"] = hourlyPrecipitationAmount;
        hourlyForecastData[hourKey]["hourlyPrecipitationDuration"] = hourlyPrecipitationDuration;
        hourlyForecastData[hourKey]["precipitationProbability"] = precipitationProbability;
        hourlyForecastData[hourKey]["smog"] = smog;
        hourlyForecastData[hourKey]["snowProbability"] = snowProbability;
        hourlyForecastData[hourKey]["symbol"] = await getTranslation(adapter, String(symbol));
        hourlyForecastData[hourKey]["symbolText"] = await getTranslation(adapter, String(symbolText));
        hourlyForecastData[hourKey]["temperature"] = temperature;
        hourlyForecastData[hourKey]["thunderstormProbability"] = thunderstormProbability;
        hourlyForecastData[hourKey]["tierAppendix"] = tierAppendix;
        hourlyForecastData[hourKey]["umbrellaState"] = await getTranslation(adapter, String(umbrellaState));
        hourlyForecastData[hourKey]["weatherInfoIndex"] = weatherInfoIndex;
        hourlyForecastData[hourKey]["windDirection"] = await getTranslation(adapter, String(windDirection));
        hourlyForecastData[hourKey]["windDirectionShortSector"] = await getTranslation(
            adapter,
            String(windDirectionShortSector),
        );
        hourlyForecastData[hourKey]["windGusts"] = windGusts;
        hourlyForecastData[hourKey]["windGustsKmh"] = windGustsKmh;
        hourlyForecastData[hourKey]["windSpeedBft"] = windSpeedBft;
        hourlyForecastData[hourKey]["windSpeedKmh"] = windSpeedKmh;

        hourlyForecastData[hourKey]["windSpeedText"] = await getTranslation(adapter, String(windSpeedText));
        hourlyForecastData[hourKey]["windy"] = await getTranslation(adapter, String(windy));
        hourlyForecastData[hourKey]["airPressure"] = airPressure;
        hourlyForecastData[hourKey]["humidity"] = humidity;

        for (const [key, value] of Object.entries(hourlyForecastData[hourKey])) {
            let type = "number";
            let role = "value";
            let unit = "";

            switch (key) {
                // Temperatures
                case "apparentTemperature":
                case "temperature":
                    role = "value.temperature";
                    unit = "°C";
                    break;
                // Strings
                case "daySynonym":
                case "dayTime":
                case "docrootVersion":
                case "symbol":
                case "umbrellaState":
                case "windy":
                case "windSpeedText":
                    type = "string";
                    break;
                case "windSpeedBft":
                case "windGustsBft":
                    type = "string";
                    role = "value.speed.wind.bft";
                    unit = "Bft";
                    break;
                case "windDirection":
                case "windDirectionShortSector":
                    type = "string";
                    role = "weather.direction.wind";
                    break;
                case "hourlyPrecipitationAmount":
                    type = "string";
                    role = "value.precipitation.amount";
                    unit = "mm";
                    break;
                case "symbolText":
                    type = "string";
                    role = "weather.symbol";
                    break;
                // Other values
                case "precipitationProbability":
                case "snowProbability":
                case "humidity":
                    role = "value.precipitation.probability";
                    unit = "%";
                    break;
                case "windSpeedKmh":
                case "windGustsKmh":
                    role = "value.speed.wind";
                    unit = "km/h";
                    break;
                case "airPressure":
                    role = "value.airPressure";
                    unit = "hPa";
                    break;
                default:
                    break;
            }

            // Define object options
            const options = {
                common: {
                    type: type,
                    role: role,
                    unit: unit,
                },
            };

            // Create or update the object in ioBroker
            await createOrUpdateObject(adapter, `forecastHourly.${hourKey}.${key}`, value, options);
        }
    }
}

/**
 * Checks if the url is valid and stores it as an object
 * @param adapter - The ioBroker adapter instance
 */
async function checkURL(adapter) {
    // Check if the url is given
    if (!adapter.config.url) {
        adapter.log.error("URL is not valid. Please provide URL in the adapter settings.");
        return false;
    }

    // Regular expression to validate the url pattern
    const urlPattern =
        /^(https?:\/\/)(www\.)?wetteronline\.de\/wetter\/[-a-zA-Z0-9@:%._+~#=]+(\/[-a-zA-Z0-9@:%._+~#=]*)?\/?$/;

    // Check if the URL matches the pattern
    if (!urlPattern.test(adapter.config.url)) {
        adapter.log.error("URL is not valid. Use this URL format: https://www.wetteronline.de/wetter/<city>");
        return false;
    }

    // Store url as object
    await createOrUpdateObject(adapter, "url", adapter.config.url, { common: { role: "url" } });
    adapter.log.info("URL: " + adapter.config.url);

    return true;
}

/**
 * Fetches the data from the url and stores into objects
 * @param adapter - The ioBroker adapter instance
 */
async function fetchDataFromURL(adapter) {
    // check if the url is valid
    if (await checkURL(adapter)) {
        // Fetch html from url
        const html = await fetchWebPage(adapter.config.url);

        // Load the HTML content into cheerio for parsing
        const $ = cheerio.load(html);

        // Check if the title indicates a "not found" page
        const title = $("title").text().trim();
        if (title === "Seite nicht gefunden - wetteronline.de") {
            adapter.log.error("URL is not valid. The specified city does not exist.");
            return;
        }

        // Fetch and create objects
        await fetchCity(adapter, $);
        await fetchTemperature(adapter, $);
        await fetchSunrise(adapter, $);
        await fetchSunset(adapter, $);
        await fetchForecastData(adapter, $);
        await fetchHourlyForecastData(adapter, $);
    }
}

module.exports = {
    checkURL,
    fetchDataFromURL,
};
