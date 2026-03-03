//Get closest by range functionality across rooms
RoomPosition.prototype.getClosestByTileDistance = function(objArray){
    let minDistance = Infinity;
    let closestObj = null;

    objArray.forEach(thisObj => {
        let thisPos = thisObj.pos;
        let distance = getTileDistance(this,thisPos);

        if (distance < minDistance) {
            minDistance = distance;
            closestObj = thisObj;
        }
    });

    return closestObj;
}