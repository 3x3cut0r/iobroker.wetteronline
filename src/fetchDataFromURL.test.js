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

    it("should fetch and store object: city", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "city", sinon.match.object);
    });

    it("should fetch and store state:  city (string)", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setStateAsync, "city", { val: sinon.match.string, ack: true });
    });

    it("should fetch and store object: temperature", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.current.temperature", sinon.match.object);
    });

    it("should fetch and store state:  temperature (number)", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.current.temperature", {
            val: sinon.match.number,
            ack: true,
        });
    });

    it("should fetch and store object: sunrise and sunset", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.current.sunrise", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.current.sunset", sinon.match.object);
    });

    it("should fetch and store state:  sunrise and sunset (string)", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.current.sunrise", {
            val: sinon.match.string,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.current.sunset", {
            val: sinon.match.string,
            ack: true,
        });
    });

    it("should fetch and store object: forecast data", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day0.temperature_max", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day0.temperature_min", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day0.precipitation", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day0.sun", sinon.match.object);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day1.temperature_max", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day1.temperature_min", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day1.precipitation", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day1.sun", sinon.match.object);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day2.temperature_max", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day2.temperature_min", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day2.precipitation", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day2.sun", sinon.match.object);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day3.temperature_max", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day3.temperature_min", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day3.precipitation", sinon.match.object);
        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.day3.sun", sinon.match.object);
    });

    it("should fetch and store state:  forecast data (number)", async () => {
        const berlinHtml = fs.readFileSync(berlinHtmlPath, "utf8");
        axiosStub.resolves({ data: berlinHtml });

        await fetchDataFromURL(adapter);

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day0.temperature_max", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day0.temperature_min", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day0.precipitation", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day0.sun", {
            val: sinon.match.number,
            ack: true,
        });

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day1.temperature_max", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day1.temperature_min", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day1.precipitation", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day1.sun", {
            val: sinon.match.number,
            ack: true,
        });

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day2.temperature_max", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day2.temperature_min", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day2.precipitation", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day2.sun", {
            val: sinon.match.number,
            ack: true,
        });

        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day3.temperature_max", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day3.temperature_min", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day3.precipitation", {
            val: sinon.match.number,
            ack: true,
        });
        sinon.assert.calledWith(adapter.setStateAsync, "forecast.day3.sun", {
            val: sinon.match.number,
            ack: true,
        });
    });
});
