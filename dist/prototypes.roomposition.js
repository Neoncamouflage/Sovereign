//Get closest by range functionality across rooms
RoomPosition.prototype.getClosestByTileDistance = function(objArray){
    let minDistance = Infinity;
    let closestPos = null;

    objArray.forEach(thisObj => {
        let thisPos = thisObj.pos;
        let distance = getTileDistance(this,thisPos);

        if (distance < minDistance) {
            minDistance = distance;
            closestPos = thisObj;
        }
    });

    return closestPos;
}