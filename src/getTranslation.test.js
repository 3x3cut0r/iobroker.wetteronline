"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const { getTranslation } = require("../src/getTranslation");

/**
 * Mock adapter instance for testing
 */
function getMockAdapter(language) {
    return {
        getForeignObjectAsync: sinon.stub().resolves({ common: { language } }),
        getObjectAsync: sinon.stub().resolves(null),
        setObjectNotExistsAsync: sinon.stub().resolves(),
        setStateAsync: sinon.stub().resolves(),
        log: {
            warn: sinon.stub(),
        },
    };
}

describe("getTranslation", () => {
    let adapter;
    let readFileSyncStub;

    beforeEach(() => {
        adapter = getMockAdapter("en");
        readFileSyncStub = sinon.stub(fs, "readFileSync");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return the correct translation for a supported language", async () => {
        const translationsPath = path.join(__dirname, "../admin/i18n/en/translations.json");
        const mockTranslations = JSON.stringify({ key: "Translated Value" });

        readFileSyncStub.withArgs(translationsPath).returns(mockTranslations);

        const result = await getTranslation(adapter, "key");
        expect(result).to.equal("Translated Value");
    });

    it("should return the key if the translation is missing", async () => {
        const translationsPath = path.join(__dirname, "../admin/i18n/en/translations.json");
        const mockTranslations = JSON.stringify({});

        readFileSyncStub.withArgs(translationsPath).returns(mockTranslations);

        const result = await getTranslation(adapter, "missingKey");
        expect(result).to.equal("missingKey");
    });

    it("should return the key if the translations file cannot be read", async () => {
        readFileSyncStub.throws(new Error("File not found"));

        const result = await getTranslation(adapter, "key");
        expect(result).to.equal("key");
        sinon.assert.calledWith(adapter.log.warn, sinon.match.string.and(sinon.match(/Cannot load translations/)));
    });

    it("should fallback to English if the language is unsupported", async () => {
        adapter = getMockAdapter("unsupportedLang");
        const translationsPath = path.join(__dirname, "../admin/i18n/en/translations.json");
        const mockTranslations = JSON.stringify({ key: "Fallback Value" });

        readFileSyncStub.withArgs(translationsPath).returns(mockTranslations);

        const result = await getTranslation(adapter, "key");
        expect(result).to.equal("Fallback Value");
    });

    it("should use the default language if the system config does not specify one", async () => {
        adapter = getMockAdapter(null); // No language specified
        const translationsPath = path.join(__dirname, "../admin/i18n/en/translations.json");
        const mockTranslations = JSON.stringify({ key: "Default Value" });

        readFileSyncStub.withArgs(translationsPath).returns(mockTranslations);

        const result = await getTranslation(adapter, "key");
        expect(result).to.equal("Default Value");
    });
});
