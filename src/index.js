"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { Chromeless } = require('chromeless')(function () {
    var childProcess = require("child_process");
    var oldSpawn = childProcess.spawn;
    console.log("Broke");
    function mySpawn() {
        console.log('spawn called');
        console.log(arguments);
        var result = oldSpawn.apply(this, arguments);
        return result;
    }
    childProcess.spawn = mySpawn;
})();
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const chromeless = new Chromeless();
        const screenshot = yield chromeless
            .goto('https://www.google.com')
            .type('chromeless', 'input[name="q"]')
            .press(13)
            .wait('#resultStats')
            .screenshot();
        console.log(screenshot); // prints local file path or S3 url
        yield chromeless.end();
    });
}
run().catch(console.error.bind(console));
//# sourceMappingURL=index.js.map