// Don't silently swallow unhandled rejections
process.on("unhandledRejection", (e) => {
    throw e;
});

// enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const chai = require("chai");

chai.should();
chai.use(sinonChai.default || sinonChai);
chai.use(chaiAsPromised.default || chaiAsPromised);
