// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
    throw e;
});

// enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
// @ts-expect-error - esm-only modules are required for tests
const sinonChai = require("sinon-chai");
// @ts-expect-error - esm-only modules are required for tests
const chaiAsPromised = require("chai-as-promised");
const chai = require("chai");

chai.should();
chai.use(sinonChai.default || sinonChai);
chai.use(chaiAsPromised.default || chaiAsPromised);
