"use strict";

const sinon = require("sinon");
const { createParent } = require("./createParent");

/**
 * Mock adapter instance for testing
 */
function getMockAdapter(existingObjects = {}) {
    return {
        getForeignObjectAsync: sinon.stub().resolves({ common: { language: "en" } }),
        getObjectAsync: sinon.stub().callsFake(async (id) => existingObjects[id] || null),
        setObjectNotExistsAsync: sinon.stub().resolves(),
        setStateAsync: sinon.stub().resolves(),
        log: {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
        },
    };
}

describe("createParent", () => {
    let adapter;

    beforeEach(() => {
        adapter = getMockAdapter();
    });

    it("should not create any objects if prefix is empty", async () => {
        await createParent(adapter, "");

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync);
    });

    it("should create a single parent as a device if firstDevice is not given", async () => {
        const prefix = "test";

        await createParent(adapter, prefix);

        sinon.assert.calledOnceWithExactly(adapter.setObjectNotExistsAsync, prefix, {
            type: "device",
            common: {
                name: "test",
            },
            native: {},
        });
    });

    it("should create a single parent as a device if firstDevice is true", async () => {
        const prefix = "test";

        await createParent(adapter, prefix, true);

        sinon.assert.calledOnceWithExactly(adapter.setObjectNotExistsAsync, prefix, {
            type: "device",
            common: {
                name: "test",
            },
            native: {},
        });
    });

    it("should create a single parent as a channel if firstDevice is false", async () => {
        const prefix = "test";

        await createParent(adapter, prefix, false);

        sinon.assert.calledOnceWithExactly(adapter.setObjectNotExistsAsync, prefix, {
            type: "channel",
            common: {
                name: "test",
            },
            native: {},
        });
    });

    it("should create multiple parent channels for a nested path", async () => {
        const prefix = "test.child1.child2";

        await createParent(adapter, prefix, true);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "test", {
            type: "device",
            common: {
                name: "test",
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "test.child1", {
            type: "channel",
            common: {
                name: "child1",
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "test.child1.child2", {
            type: "channel",
            common: {
                name: "child2",
            },
            native: {},
        });
    });

    it("should skip creating existing objects", async () => {
        const existingObjects = {
            forecast: { type: "device" },
            "forecast.current": { type: "channel" },
        };

        adapter = getMockAdapter(existingObjects);

        const prefix = "forecast.current.test";

        await createParent(adapter, prefix, true);

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync.withArgs("forecast"));
        sinon.assert.notCalled(adapter.setObjectNotExistsAsync.withArgs("forecast.current"));

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "forecast.current.test", {
            type: "channel",
            common: {
                name: "test",
            },
            native: {},
        });
    });
});
