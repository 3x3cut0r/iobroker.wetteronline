"use strict";

const { createOrUpdateParent } = require("./createOrUpdateParent");
const { getTranslation } = require("./getTranslation");

/**
 * Create an ioBroker object
 * @param {object} adapter - The ioBroker adapter instance.
 * @param {string} name - The name of the object including path(e.g., "forecast.current.day0.temperature").
 * @param {string|number|null} value - The value of the object.
 * @param {object} options - The object options.
 * @returns {Promise<void>} - A promise that resolves when all channels are created.
 */
async function createOrUpdateObject(adapter, name, value, options = {}) {
    // Skip if name is empty
    if (!name) {
        return;
    }

    // Skip if value is undefined
    if (value === undefined) {
        return;
    }

    // Split the name into prefix and object name
    let prefix = "";
    let objectName = name;

    if (name.includes(".")) {
        const lastDotIndex = name.lastIndexOf(".");
        prefix = name.substring(0, lastDotIndex);
        objectName = name.substring(lastDotIndex + 1);
    }

    const common = options.common ?? {};

    // Create the parent objects
    await createOrUpdateParent(adapter, prefix, options.firstDevice ?? true);

    // Define the object
    const object = {
        type: options.type ?? "state",
        common: {
            name: await getTranslation(adapter, common.name ?? objectName),
            type: common.type ?? "string",
            role: common.role ?? "value",
            unit: common.unit ?? "",
            read: common.read ?? true,
            write: common.write ?? false,
        },
        native: options.native ?? {},
    };

    // Check if the object already exists
    const existingObject = await adapter.getObjectAsync(name);
    if (!existingObject) {
        // Create the object
        await adapter.setObjectNotExistsAsync(name, object);
    } else {
        // Update the object
        await adapter.extendObjectAsync(name, object);
    }

    // Set the object state
    await adapter.setStateAsync(name, { val: value, ack: true });
}

module.exports = {
    createOrUpdateObject,
};
