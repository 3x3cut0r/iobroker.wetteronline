"use strict";

// const { expect } = require("chai");
const sinon = require("sinon");
const { createOrUpdateObject } = require("./createOrUpdateObject");

/**
 * Mock adapter instance for testing
 */
function getMockAdapter(existingObject) {
    return {
        extendObjectAsync: sinon.stub().resolves(),
        getForeignObjectAsync: sinon.stub().resolves({ common: { language: "en" } }),
        getObjectAsync: sinon.stub().resolves(existingObject),
        setObjectNotExistsAsync: sinon.stub().resolves(),
        setStateAsync: sinon.stub().resolves(),
        log: {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
        },
    };
}

describe("createOrUpdateObject", () => {
    let adapter;

    beforeEach(() => {
        adapter = getMockAdapter();
    });

    it("should not create an object if name is empty", async () => {
        await createOrUpdateObject(adapter, "", "some value");

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync);
        sinon.assert.notCalled(adapter.extendObjectAsync);
        sinon.assert.notCalled(adapter.setStateAsync);
    });

    it("should not create an object if value is undefined", async () => {
        // @ts-ignore
        await createOrUpdateObject(adapter, "test.object", undefined);

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync);
        sinon.assert.notCalled(adapter.extendObjectAsync);
        sinon.assert.notCalled(adapter.setStateAsync);
    });

    it("should create a new object with default options", async () => {
        const name = "test.object";
        const value = "test value";

        await createOrUpdateObject(adapter, name, value);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, name, {
            type: "state",
            common: {
                name: "object",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false,
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setStateAsync, name, {
            val: value,
            ack: true,
        });
    });

    it("should create an object with custom options", async () => {
        const name = "parent.child.test";
        const value = 5;
        const options = {
            type: "state",
            common: {
                name: "test",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
        };

        await createOrUpdateObject(adapter, name, value, options);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, name, {
            type: "state",
            common: {
                name: "test",
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setStateAsync, name, {
            val: value,
            ack: true,
        });
    });

    it("should create parent channels if necessary", async () => {
        const name = "parent.child.test";
        const value = "test value";

        await createOrUpdateObject(adapter, name, value);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "parent", {
            type: "device",
            common: {
                name: "parent",
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, "parent.child", {
            type: "channel",
            common: {
                name: "child",
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, name, {
            type: "state",
            common: {
                name: "test",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false,
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setStateAsync, name, {
            val: value,
            ack: true,
        });
    });

    it("should update an existing object", async () => {
        const existingObject = {
            type: "state",
            common: {
                name: "existing_object",
                type: "string",
                role: "value",
                unit: "",
                read: true,
                write: false,
            },
            native: {},
        };
        const adapter = getMockAdapter(existingObject);
        const name = "existing_object";
        const newValue = "updated value";

        await createOrUpdateObject(adapter, name, newValue);

        sinon.assert.notCalled(adapter.setObjectNotExistsAsync);
        sinon.assert.calledWith(adapter.extendObjectAsync, name, existingObject);
        sinon.assert.calledWith(adapter.setStateAsync, name, {
            val: newValue,
            ack: true,
        });
    });

    it("should translate the common.name value", async () => {
        const adapter = getMockAdapter(null);
        adapter.getForeignObjectAsync.resolves({ common: { language: "de" } });

        const name = "forecast.current.temperature";
        const value = "test value";
        const options = {
            type: "state",
            common: {
                name: "temperature", // English value (en)
                type: "number",
                role: "value.temperature",
                unit: "°C",
            },
        };

        await createOrUpdateObject(adapter, name, value, options);

        sinon.assert.calledWith(adapter.setObjectNotExistsAsync, name, {
            type: "state",
            common: {
                name: "Temperatur", // Translated value (de)
                type: "number",
                role: "value.temperature",
                unit: "°C",
                read: true,
                write: false,
            },
            native: {},
        });

        sinon.assert.calledWith(adapter.setStateAsync, name, {
            val: value,
            ack: true,
        });
    });
});
