"use strict";

const utils = require("@iobroker/adapter-core");
const { fetchDataFromURL } = require("./src/fetchDataFromURL");

class Wetteronline extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "wetteronline",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("objectChange", this.onObjectChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        const intervalInMinutes = 25; // Interval in minutes
        const intervalInMilliseconds = intervalInMinutes * 60 * 1000;

        // Random start offset (between 0 and the interval)
        const randomOffset = Math.floor(Math.random() * intervalInMilliseconds); // Milliseconds
        const randomOffsetInMinutes = Math.floor(randomOffset / 1000 / 60); // Minutes
        const randomOffsetInMinutesRest = Math.floor(randomOffset / 1000) - randomOffsetInMinutes * 60; // Rest in seconds

        this.log.info(
            `Setting periodic execution every ${intervalInMinutes} minutes with a random offset of ${randomOffsetInMinutes} minutes and ${randomOffsetInMinutesRest} seconds.`,
        );

        // Execute once initially
        await fetchDataFromURL(this).catch((error) => {
            this.log.error(`Error fetching data from url (initial): ${error.message}`);
        });

        // Initial timeout with random offset
        this.timeout = setTimeout(() => {
            this.startPeriodicExecution(intervalInMilliseconds);
        }, randomOffset);
    }

    /**
     * Start the periodic execution of data fetching.
     * @param {number} interval - The interval in milliseconds.
     */
    async startPeriodicExecution(interval) {
        // Execute periodically
        this.interval = setInterval(async () => {
            try {
                this.log.info("Running periodic task...");
                await fetchDataFromURL(this);
            } catch (error) {
                this.log.error(`Error fetching data from url: ${error.message}`);
            }
        }, interval);
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj && id === `system.adapter.${this.namespace}`) {
            this.log.info("Adapter configuration changed.");

            // Check if the url has been updated
            const newurl = obj.native?.url;
            if (newurl && newurl !== this.config.url) {
                // Update url
                this.config.url = newurl;
                this.onReady();
            }
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Clean timeout
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.log.info("Cleared start timeout.");
            }

            // Clean interval
            if (this.interval) {
                clearInterval(this.interval);
                this.log.info("Cleared periodic interval.");
            }

            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Wetteronline(options);
} else {
    // Otherwise start the instance directly
    new Wetteronline();
}
