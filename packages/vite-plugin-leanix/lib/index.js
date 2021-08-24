"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doSomeStuff = void 0;
function doSomeStuff(withThis, andThat, andThose) {
    // function on one line
    if (andThose.length === 0) {
        return false;
    }
    console.log(withThis);
    console.log(andThat);
    console.dir(andThose);
}
exports.doSomeStuff = doSomeStuff;
// TODO: more examples
//# sourceMappingURL=index.js.map