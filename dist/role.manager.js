var roleManager = {

    /** @param {Creep} creep **/
    run: function(creep) {
        let managerSpot = creep.memory.managerSpot;
        let fief = Memory.kingdom.fiefs[creep.room.name];
        let coreLink = Game.getObjectById(fief.links.coreLink);
        let upLink = Game.getObjectById(fief.links.upLink);
        if(creep.pos.x != managerSpot.x || creep.pos.y != managerSpot.y){
            creep.travelTo(new RoomPosition(managerSpot.x,managerSpot.y,creep.room.name));
            return;
        }
        else{
            creep.memory.inPosition = true;
        }
        //If about to die
        if(creep.ticksToLive < 5){
            //If anything in inventory, dump it to storage
            if(creep.store.getUsedCapacity() > 0){
                for(const resourceType in creep.store) {
                    creep.transfer(creep.room.storage, resourceType);
                    return;
                }
            }
            //If empty, die
            else{
                creep.suicide();
            }
        }
        
    }
};

module.exports = roleManager;

