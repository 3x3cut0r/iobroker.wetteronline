"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Get the translation text of the given key from translations.json
 * @param adapter - The ioBroker adapter instance
 * @param {string} value - The value to translate
 * @returns {Promise<string>} - A promise that returns the translated value of the given value
 */
async function getTranslation(adapter, value) {
    // Determine current language from system config
    const systemConfig = await adapter.getForeignObjectAsync("system.config");
    let lang = systemConfig?.common?.language || "en";

    // Supported languages
    const supportedLanguages = ["de", "en", "es", "fr", "it", "nl", "pl", "pt", "ru", "uk", "zh-cn"];

    // Fallback if unsupported
    if (!supportedLanguages.includes(lang)) {
        lang = "en";
    }

    // Build the path to admin/i18n/<lang>/translations.json
    const translationsPath = path.join(__dirname, "..", "admin", "i18n", lang, "translations.json");

    let translations = {};
    try {
        const fileContent = fs.readFileSync(translationsPath, "utf8");
        translations = JSON.parse(fileContent);
    } catch (error) {
        adapter.log.warn(`Cannot load translations for language "${lang}": ${error.message}`);
        return value;
    }

    return Object.prototype.hasOwnProperty.call(translations, value) ? translations[value] : value;
}

module.exports = {
    getTranslation,
};
