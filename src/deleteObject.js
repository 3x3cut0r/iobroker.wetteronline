"use strict";

/**
 * Delete an ioBroker object
 * @param {object} adapter - The ioBroker adapter instance.
 * @param {string} name - The name of the object including path (e.g., "forecast.current.day0").
 * @returns {Promise<boolean>} - True, if the object was deleted successfully.
 */
async function deleteObject(adapter, name) {
    // Skip if name is empty
    if (!name) {
        return false;
    }

    try {
        // Delete the Object
        await adapter.delObjectAsync(name, { recursive: true });
        return true;
    } catch (error) {
        adapter.log.error(`Failed to delete object ${name}: ${error.message}`);
    }
    return false;
}

/**
 * Delete all objects created by the adapter.
 * @param {object} adapter - The ioBroker adapter instance.
 * @returns {Promise<void>} - A promise that resolves when all objects are deleted.
 */
async function deleteAdapterObjects(adapter) {
    try {
        // Get all objects of the adapter
        const objects = await adapter.getAdapterObjectsAsync();

        // Delete all objects
        for (const id of Object.keys(objects)) {
            await deleteObject(adapter, id);
        }
    } catch (error) {
        adapter.log.error(`Error while deleting adapter objects: ${error.message}`);
    }
}

module.exports = {
    deleteObject,
    deleteAdapterObjects,
};
