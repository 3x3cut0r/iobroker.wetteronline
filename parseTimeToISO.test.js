const { expect } = require("chai");
const { parseTimeToISO } = require("./src/fetchDataFromURL");

const adapter = { log: { warn: () => {} } };

describe("parseTimeToISO", () => {
    it("returns ISO string for valid time", () => {
        const result = parseTimeToISO(adapter, "12:34", "sunrise");
        expect(result).to.be.a("string");
    });

    it("returns null for invalid time", () => {
        const result = parseTimeToISO(adapter, "invalid", "sunrise");
        expect(result).to.be.null;
    });

    it("does not throw when toISOString fails", () => {
        const original = Date.prototype.toISOString;
        Date.prototype.toISOString = () => {
            throw new RangeError("Invalid time value");
        };
        const result = parseTimeToISO(adapter, "01:02", "sunrise");
        expect(result).to.be.null;
        Date.prototype.toISOString = original;
    });
});
