"use strict";

const { getTranslation } = require("./getTranslation");

/**
 * Creates channels for the parent objects of a given prefix ( = path).
 * @param {object} adapter - The ioBroker adapter instance.
 * @param {string} prefix - The prefix ( = path) to create (e.g. "forecast.current.day0").
 * @param {boolean} firstDevice - If true, the first segment (e.g. "forecast") is a device instead of a channel.
 * @returns {Promise<void>} - A promise that resolves when all channels are created.
 */
async function createParent(adapter, prefix, firstDevice = true) {
    // Skip if prefix is empty
    if (!prefix) {
        return;
    }

    const segments = prefix.split(".");
    let currentPath = "";

    for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;

        // Check if the channel or device already exists
        const existingObject = await adapter.getObjectAsync(currentPath);
        if (existingObject) {
            // Skip creation if it exists
            continue;
        }

        // Determine type: the root segment is a device if firstDevice, others are channels
        const type = firstDevice && currentPath === segments[0] ? "device" : "channel";

        // Create the object
        await adapter.setObjectNotExistsAsync(currentPath, {
            type: type,
            common: {
                name: await getTranslation(adapter, segment),
            },
            native: {},
        });
    }
}

module.exports = {
    createParent,
};
