"use strict";

const { expect } = require("chai");
const sinon = require("sinon");
const { deleteObject, deleteAdapterObjects } = require("./deleteObject");

/**
 * Mock adapter instance for testing
 */
function getMockAdapter(existingObjects = {}) {
    return {
        delObjectAsync: sinon.stub().resolves(),
        getAdapterObjectsAsync: sinon.stub().resolves(existingObjects),
        log: {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
        },
    };
}

describe("deleteObject", () => {
    let adapter;

    beforeEach(() => {
        adapter = getMockAdapter();
    });

    it("should return false if the name is empty", async () => {
        await deleteObject(adapter, "");
        sinon.assert.notCalled(adapter.delObjectAsync);
    });

    it("should delete the object if the name is valid", async () => {
        const name = "test.object";

        const result = await deleteObject(adapter, name);

        sinon.assert.calledWith(adapter.delObjectAsync, name, { recursive: true });
        expect(result).to.be.true;
    });

    it("should log an error if the deletion fails", async () => {
        const name = "test.object";
        adapter.delObjectAsync.rejects(new Error("Deletion error"));

        const result = await deleteObject(adapter, name);

        sinon.assert.calledWith(adapter.delObjectAsync, name, { recursive: true });
        sinon.assert.calledWith(adapter.log.error, sinon.match(/Failed to delete object/));
        expect(result).to.be.false;
    });
});

describe("deleteAdapterObjects", () => {
    let adapter;

    beforeEach(() => {
        adapter = getMockAdapter({
            "test.object1": {},
            "test.object2": {},
        });
    });

    it("should delete all objects of the adapter", async () => {
        await deleteAdapterObjects(adapter);

        sinon.assert.calledWith(adapter.delObjectAsync, "test.object1", { recursive: true });
        sinon.assert.calledWith(adapter.delObjectAsync, "test.object2", { recursive: true });
    });

    it("should log an error if object deletion fails", async () => {
        adapter.delObjectAsync.withArgs("test.object1").rejects(new Error("Deletion error"));

        await deleteAdapterObjects(adapter);

        sinon.assert.calledWith(adapter.delObjectAsync, "test.object1", { recursive: true });
        sinon.assert.calledWith(adapter.delObjectAsync, "test.object2", { recursive: true });
        sinon.assert.calledWith(adapter.log.error, sinon.match(/Failed to delete object/));
    });
});
