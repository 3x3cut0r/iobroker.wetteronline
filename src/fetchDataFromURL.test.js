"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { checkURL, fetchDataFromURL } = require("../src/fetchDataFromURL");

// Mock adapter instance
function getMockAdapter() {
    return {
        config: { url: "https://www.wetteronline.de/wetter/berlin" },
        log: {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
        },
        extendObjectAsync: sinon.stub().resolves(),
        getForeignObjectAsync: sinon.stub().resolves({ common: { language: "en" } }),
        getObjectAsync: sinon.stub().resolves(null),
        setObjectNotExistsAsync: sinon.stub().resolves(),
        setStateAsync: sinon.stub().resolves(),
    };
}

describe("fetchDataFromURL", () => {
    let adapter;
    let axiosStub;
    const berlinHtmlPath = path.join(__dirname, "../test/berlin.html");
    const notFoundHtmlPath = path.join(__dirname, "../test/404.html");

    beforeEach(() => {
        adapter = getMockAdapter();
        axiosStub = sinon.stub(axios, "get");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should log an error if the URL is missing", async () => {
        adapter.config.url = null;

        const result = await checkURL(adapter);

        expect(result).to.be.false;
        sinon.assert.calledWith(adapter.log.error, sinon.match(/Please provide URL in the adapter settings/));
    });

    it("should log an error if the URL is invalid", async () => {
        adapter.config.url = "invalid-url";

        const result = await checkURL(adapter);

        expect(result).to.be.false;
        sinon.assert.calledWith(adapter.log.error, sinon.match(/URL is not valid/));
    });

    it("should validate and store valid URLs", async () => {
        const validUrls = [
            "https://www.wetteronline.de/wetter/berlin",
            "http://www.wetteronline.de/wetter/hamburg/",
            "https://wetteronline.de/wetter/muenchen/",
            "https://www.wetteronline.de/wetter/frankfurt-am-main/harheim",
        ];

        for (const url of validUrls) {
            adapter.config.url = url;

            const result = await checkURL(adapter);
            expect(result).to.be.true;

            sinon.assert.calledWith(
                adapter.setObjectNotExistsAsync,
                "url",
                sinon.match({
                    type: "state",
                    common: sinon.match({
                        role: "url",
                        type: "string",
                    }),
                }),
            );
            sinon.assert.calledWith(adapter.log.info, sinon.match(new RegExp(`URL: ${url.replace(/\//g, "\\/")}`)));
        }
    });

    it("should log an error for URLs that do not match the expected pattern", async () => {
        const invalidUrls = [
            "https://example.com",
            "http://wetteronline.com/wetter/berlin",
            "https://wetteronline.com/wetter/berlin",
            "ftp://www.wetteronline.de/wetter/berlin",
            "https://wetteronline.de/forecast/berlin",
            "www.wetteronline.de/wetter/berlin",
        ];

        for (const url of invalidUrls) {
            adapter.config.url = url;

            const result = await checkURL(adapter);
            expect(result).to.be.false;

            sinon.assert.calledWith(adapter.log.error, sinon.match(/URL is not valid/));
        }
    });

    it("should log an error if the page title indicates a 404", async () => {
        const notFoundHtml = fs.readFileSync(notFoundHtmlPath, "utf8");
        axiosStub.resolves({ data: notFoundHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.log.error, sinon.match(/URL is not valid/));
    });

    it("should fetch and store objects: url, city", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        const expectedKeys = {
            url: sinon.match.string,
            city: sinon.match.string,
        };

        Object.entries(expectedKeys).forEach(([key, value]) => {
            sinon.assert.calledWith(adapter.setObjectNotExistsAsync, `${key}`, sinon.match.object);
            sinon.assert.calledWith(adapter.setStateAsync, `${key}`, {
                val: value,
                ack: true,
            });
        });
    });

    it("should fetch and store objects: forecast.current", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        const expectedKeys = {
            sunrise: sinon.match.string,
            sunset: sinon.match.string,
            temperature: sinon.match.number,
        };

        Object.entries(expectedKeys).forEach(([key, value]) => {
            sinon.assert.calledWith(adapter.setObjectNotExistsAsync, `forecast.current.${key}`, sinon.match.object);
            sinon.assert.calledWith(adapter.setStateAsync, `forecast.current.${key}`, {
                val: value,
                ack: true,
            });
        });
    });

    it("should fetch and store objects: forecast.Xd.Ydt", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        const expectedDayKeyMatchers = {
            precipitation: sinon.match.number,
            sun: sinon.match.number,
            temperatureMax: sinon.match.number,
            temperatureMin: sinon.match.number,
        };
        const expectedDaytimeKeyMatchers = {
            precipitation: sinon.match.number,
            windGustsBft: sinon.match.string,
            windGustsKmh: sinon.match.number,
            windSpeedText: sinon.match.string,
            windDirection: sinon.match.string,
            windSpeedKmh: sinon.match.number,
            windSpeedBft: sinon.match.string,
            temperature: sinon.match.number,
            temperatureFeelslike: sinon.match.number,
            windDirectionShortSector: sinon.match.string,
        };
        const expectedDays = 4;
        const expectedDaytimes = 4;

        // For each day (0-3)
        for (let dayIndex = 0; dayIndex < expectedDays; dayIndex++) {
            Object.entries(expectedDayKeyMatchers).forEach(([dayKey, dayMatcher]) => {
                const expectedObjectCall = [`forecast.${dayIndex}d.${dayKey}`, sinon.match.object];
                sinon.assert.calledWithMatch(
                    adapter.setObjectNotExistsAsync,
                    expectedObjectCall[0],
                    expectedObjectCall[1],
                );
                const expectedStateCall = [`forecast.${dayIndex}d.${dayKey}`, { val: dayMatcher, ack: true }];
                sinon.assert.calledWithMatch(adapter.setStateAsync, expectedStateCall[0], expectedStateCall[1]);
            });

            // For each daytime (0-3)
            for (let daytimeIndex = 0; daytimeIndex < expectedDaytimes; daytimeIndex++) {
                Object.entries(expectedDaytimeKeyMatchers).forEach(([daytimeKey, daytimeMatcher]) => {
                    const expectedObjectCall = [
                        `forecast.${dayIndex}d.${daytimeIndex}dt.${daytimeKey}`,
                        sinon.match.object,
                    ];
                    sinon.assert.calledWithMatch(
                        adapter.setObjectNotExistsAsync,
                        expectedObjectCall[0],
                        expectedObjectCall[1],
                    );

                    const expectedStateCall = [
                        `forecast.${dayIndex}d.${daytimeIndex}dt.${daytimeKey}`,
                        { val: daytimeMatcher, ack: true },
                    ];
                    sinon.assert.calledWithMatch(adapter.setStateAsync, expectedStateCall[0], expectedStateCall[1]);
                });
            }
        }
    });

    it("should fetch and store at least 25 hourly forecasts", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        // Filter calls to setObjectNotExistsAsync for forecastHourly
        const stateCalls = adapter.setStateAsync.getCalls().map((call) => call.args[0]);

        // Use a Set to track which hourKey (0h, 1h, 2h...) we got
        const hourSet = new Set();
        stateCalls.forEach((id) => {
            const match = id.match(/^forecastHourly\.(\d+)h\./);
            if (match) {
                hourSet.add(match[1]); // e.g. '0', '1', '2'...
            }
        });

        // Expect at least 25 distinct hours
        expect(hourSet.size).to.be.at.least(25);
    });

    it("should fetch and store objects: forecastHourly.Xh", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        const expectedHourKeyMatchers = {
            apparentTemperature: (val) => typeof val === "number",
            daySynonym: (val) => typeof val === "string",
            dayTime: (val) => typeof val === "string",
            docrootVersion: (val) => typeof val === "string",
            freshSnowDepth: (val) => typeof val === "number",
            hour: (val) => typeof val === "number",
            hourlyPrecipitationAmount: (val) => typeof val === "string",
            hourlyPrecipitationDuration: (val) => typeof val === "number",
            precipitationProbability: (val) => typeof val === "number",
            smog: (val) => typeof val === "number",
            snowProbability: (val) => typeof val === "number",
            symbol: (val) => typeof val === "string",
            symbolText: (val) => typeof val === "string",
            temperature: (val) => typeof val === "number",
            thunderstormProbability: (val) => typeof val === "number",
            tierAppendix: (val) => typeof val === "number",
            umbrellaState: (val) => typeof val === "string",
            weatherInfoIndex: (val) => typeof val === "number",
            windDirection: (val) => typeof val === "string",
            windDirectionShortSector: (val) => typeof val === "string",
            windGusts: (val) => typeof val === "number",
            windGustsKmh: (val) => typeof val === "number",
            windSpeedBft: (val) => typeof val === "string",
            windSpeedKmh: (val) => typeof val === "number",
            windSpeedText: (val) => typeof val === "string",
            windy: (val) => typeof val === "string",
            airPressure: (val) => typeof val === "number",
            humidity: (val) => typeof val === "number",
        };

        // Store calls
        const stateCalls = adapter.setStateAsync.getCalls();
        const forecastHourlyCalls = stateCalls.filter((call) => call.args[0].startsWith("forecastHourly."));

        // Validate each key
        forecastHourlyCalls.forEach((call) => {
            const keyMatch = call.args[0].match(/^forecastHourly\.(\d+)h\.(.+)$/);
            if (keyMatch) {
                const [, , key] = keyMatch;
                const value = call.args[1].val;

                if (expectedHourKeyMatchers[key]) {
                    expect(expectedHourKeyMatchers[key](value)).to.be.true;
                }
            }
        });
    });
});
