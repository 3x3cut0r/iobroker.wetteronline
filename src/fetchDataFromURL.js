"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const { createObject } = require("./createObject");

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
    await createObject(adapter, "city", value);
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
    await createObject(adapter, "forecast.current.temperature", value, options);
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
    await createObject(adapter, "forecast.current.sunrise", value, options);
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
    await createObject(adapter, "forecast.current.sunset", value, options);
}

/**
 * Extracts forecast data (min, max, sun teaser, and precipitation teaser) from the HTML content.
 * @param adapter - The ioBroker adapter instance
 * @param $ - The loaded Cheerio object.
 */
async function fetchForecastData(adapter, $) {
    // Find and store forecast data
    const forecastData = {};

    // Loop through each day column in the forecast table
    $("#forecasttable #weather tbody tr").each((index, row) => {
        const rowType = $(row).attr("class");

        if (rowType === "Maximum Temperature") {
            $(row)
                .find("td")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const maxTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                    forecastData[dayKey].temperature_max = isNaN(maxTemp) ? null : maxTemp;
                });
        }

        if (rowType === "Minimum Temperature") {
            $(row)
                .find("td")
                .each((dayIndex, cell) => {
                    const dayKey = `day${dayIndex}`;
                    if (!forecastData[dayKey]) forecastData[dayKey] = {};
                    const minTemp = parseInt($(cell).find(".temp").text().replace("°", "").trim(), 10);
                    forecastData[dayKey].temperature_min = isNaN(minTemp) ? null : minTemp;
                });
        }

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
    });

    // Store forecast data
    for (const [day, values] of Object.entries(forecastData)) {
        for (const [key, value] of Object.entries(values)) {
            // Determine common values based on key
            let role = "value";
            let unit = "";

            switch (key) {
                case "temperature_max":
                    role = `value.temperature.max.forecast.${day.replace(/^day/, "")}`;
                    unit = "°C";
                    break;
                case "temperature_min":
                    role = `value.temperature.min.forecast.${day.replace(/^day/, "")}`;
                    unit = "°C";
                    break;
                case "precipitation":
                    role = `value.precipitation.forecast.${day.replace(/^day/, "")}`;
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
            await createObject(adapter, `forecast.${day}.${key}`, value, options);
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
    await createObject(adapter, "url", adapter.config.url, { common: { role: "url" } });
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
