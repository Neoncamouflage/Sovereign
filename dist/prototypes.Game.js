const _findRoute = Game.map.findRoute;
Game.map.findRoute = function (fromRoom, toRoom, opts) {
    console.log("PATCHED!")
    return _findRoute.call(this, fromRoom, toRoom, opts);
}