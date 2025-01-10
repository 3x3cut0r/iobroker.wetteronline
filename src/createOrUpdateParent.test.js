"use strict";

const sinon = require("sinon");
const { createOrUpdateParent } = require("./createOrUpdateParent");

/**
 * Mock adapter instance for testing
 */
function getMockAdapter(existingObjects = {}) {
    return {
        extendObjectAsync: sinon.stub().resolves(),
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

describe("createOrUpdateParent", () => {
    let adapter;

    beforeEach(() => {
        adapter = getMockAdapter();
    });

    it("should not create any objects if prefix is empty", async () => {
        await createOrUpdateParent(adapter, "");

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync);
    });

    it("should create a single parent as a device if firstDevice is not given", async () => {
        const prefix = "test";

        await createOrUpdateParent(adapter, prefix);

        sinon.assert.notCalled(adapter.extendObjectAsync);
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

        await createOrUpdateParent(adapter, prefix, true);

        sinon.assert.notCalled(adapter.extendObjectAsync);
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

        await createOrUpdateParent(adapter, prefix, false);

        sinon.assert.notCalled(adapter.extendObjectAsync);
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

        await createOrUpdateParent(adapter, prefix, true);

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

    it("should update existing objects", async () => {
        const existingObjects = {
            test: { type: "device" },
            "test.child1": { type: "channel" },
        };

        adapter = getMockAdapter(existingObjects);

        const prefix = "test.child1";

        await createOrUpdateParent(adapter, prefix, true);

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync.withArgs("test"));
        sinon.assert.calledWith(adapter.extendObjectAsync, "test", {
            type: "device",
            common: {
                name: "test",
            },
            native: {},
        });
        sinon.assert.notCalled(adapter.setObjectNotExistsAsync.withArgs("test.child1"));
        sinon.assert.calledWith(adapter.extendObjectAsync, "test.child1", {
            type: "channel",
            common: {
                name: "child1",
            },
            native: {},
        });
    });
});
