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
    const response = await axios.get(url);
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
 * Extracts the sunrise time from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchSunrise(adapter, $) {
    // Find and store value
    const sunrise = $("#sunrise-sunset-today #sunrise").text().trim();

    // Create a Date object with today's date and the given time
    const [hours, minutes] = sunrise.split(":").map(Number);
    const now = new Date();
    const value = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).toISOString();

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

    // Create a Date object with today's date and the given time
    const [hours, minutes] = sunset.split(":").map(Number);
    const now = new Date();
    const value = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).toISOString();

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
    $("#forecasttable #weather tbody tr").each(async (index, row) => {
        const rowType = $(row).attr("class");

        // Maximum temperature
        if (rowType === "Maximum Temperature") {
            $(row)
                .find("td")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const maxTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                    forecastData[dayKey].temperatureMax = isNaN(maxTemp) ? null : maxTemp;
                });
        }

        // Minimum temperature
        if (rowType === "Minimum Temperature") {
            $(row)
                .find("td")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const minTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                    forecastData[dayKey].temperatureMin = isNaN(minTemp) ? null : minTemp;
                });
        }

        // Sun hours
        if ($(row).attr("id") === "sun_teaser") {
            $(row)
                .find("td span")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const sunTeaser = parseInt($(cell).text().replace("Std.", "").trim(), 10);
                    forecastData[dayKey].sun = isNaN(sunTeaser) ? null : sunTeaser;
                });
        }

        // Probability of precipitation
        if ($(row).attr("id") === "precipitation_teaser") {
            $(row)
                .find("td span")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const precipitationTeaser = parseInt($(cell).text().replace("%", "").trim(), 10);
                    forecastData[dayKey].precipitation = isNaN(precipitationTeaser) ? null : precipitationTeaser;
                });
        }

        // daytime0-3 (Morning, Afternoon, Evening, Night)
        if (rowType === "symbol") {
            const daytimeIndex = daytimeCounter;
            daytimeCounter++;

            $(row)
                .find("td")
                .each(async (dayIndex, cell) => {
                    // Read the data-tt-args attribute
                    const dataAttr = $(cell).attr("data-tt-args");
                    if (!dataAttr) return;

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

                    // Build the day key (day0, day1, day2, day3)
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) {
                        forecastData[dayKey] = {};
                    }

                    // Build the daytime keys (daytime0, daytime1, daytime2, daytime3)
                    const daytimeKey = `daytime${daytimeIndex}`;
                    if (!forecastData[dayKey][daytimeKey]) {
                        forecastData[dayKey][daytimeKey] = {};
                    }

                    // Store the values
                    forecastData[dayKey][daytimeKey].precipitation = precipitation;
                    forecastData[dayKey][daytimeKey].windGustsBft = await getTranslation(adapter, String(windGustsBft));
                    forecastData[dayKey][daytimeKey].windGustsKmh = windGustsKmh;
                    forecastData[dayKey][daytimeKey].windSpeedText = await getTranslation(
                        adapter,
                        String(windSpeedText),
                    );
                    forecastData[dayKey][daytimeKey].windDirection = await getTranslation(
                        adapter,
                        String(windDirection),
                    );
                    forecastData[dayKey][daytimeKey].windSpeedKmh = windSpeedKmh;
                    forecastData[dayKey][daytimeKey].windSpeedBft = await getTranslation(adapter, String(windSpeedBft));
                    forecastData[dayKey][daytimeKey].temperature = temperature;
                    forecastData[dayKey][daytimeKey].temperatureFeelslike = temperatureFeelslike;
                    forecastData[dayKey][daytimeKey].windDirectionShortSector = await getTranslation(
                        adapter,
                        String(windDirectionShortSector),
                    );
                });
        }
    });

    // Store forecast data
    for (const [day, values] of Object.entries(forecastData)) {
        const dayNumber = `${day.replace(/^day/, "")}`;

        for (const [key, value] of Object.entries(values)) {
            if (key.startsWith("daytime")) {
                const daytime = key;
                const daytimeValues = value;

                // Store daytimes
                for (const [key, value] of Object.entries(daytimeValues)) {
                    let type = "number";
                    let role = "value";
                    let unit = "";

                    switch (key) {
                        case "precipitation":
                            if (daytime === "daytime0" || daytime === "daytime1") {
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
                            type = "string";
                            role = `weather.direction.wind.forecast.${dayNumber}`;
                            break;
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
    }
}

module.exports = {
    checkURL,
    fetchDataFromURL,
};
