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

    it("should fetch and store objects: forecast.dayX.daytimeY", async () => {
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
                const expectedObjectCall = [`forecast.day${dayIndex}.${dayKey}`, sinon.match.object];
                sinon.assert.calledWithMatch(
                    adapter.setObjectNotExistsAsync,
                    expectedObjectCall[0],
                    expectedObjectCall[1],
                );
                const expectedStateCall = [`forecast.day${dayIndex}.${dayKey}`, { val: dayMatcher, ack: true }];
                sinon.assert.calledWithMatch(adapter.setStateAsync, expectedStateCall[0], expectedStateCall[1]);
            });

            // For each daytime (0-3)
            for (let daytimeIndex = 0; daytimeIndex < expectedDaytimes; daytimeIndex++) {
                Object.entries(expectedDaytimeKeyMatchers).forEach(([daytimeKey, daytimeMatcher]) => {
                    const expectedObjectCall = [
                        `forecast.day${dayIndex}.daytime${daytimeIndex}.${daytimeKey}`,
                        sinon.match.object,
                    ];
                    sinon.assert.calledWithMatch(
                        adapter.setObjectNotExistsAsync,
                        expectedObjectCall[0],
                        expectedObjectCall[1],
                    );

                    const expectedStateCall = [
                        `forecast.day${dayIndex}.daytime${daytimeIndex}.${daytimeKey}`,
                        { val: daytimeMatcher, ack: true },
                    ];
                    sinon.assert.calledWithMatch(adapter.setStateAsync, expectedStateCall[0], expectedStateCall[1]);
                });
            }
        }
    });
});
