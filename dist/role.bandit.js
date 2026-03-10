const helper = require('functions.helper');

let posRef = {
    '698f8a2f9ff46d2d65f5be8b':{x:8,y:30,roomName:'W1N63'},
    '698f8a2f9ff46d2d65f5be8a':{x:15,y:16,roomName:'W1N63'},
    '698f8a0f9ff46d2d65f5b521':{x:26,y:15,roomName:'W7N64'},
    '698f8a0f9ff46d2d65f5b523':{x:28,y:41,roomName:'W7N64'}
}

/**
spawnCreep('bait','4m1p','W7N64',98,{job:'jump'})
    spawnCreep('bait','6m3w2c','W7N64',91,{job:'transit',holdRole:'upgrader',targetRoom:'W7N64'})
 SMALL -------- spawnCreep('bait','5m5c','W1N63',90,{job:'transit',holdRole:'hauler',targetRoom:'W7N64'})

//spawnCreep('bait','6m4w1c','W7N64',92,{target:'698f8a2f9ff46d2d65f5be8b'})
//spawnCreep('bait','6m4w1c','W7N64',92,{target:'698f8a2f9ff46d2d65f5be8a'})

spawnCreep('bait','10mc','W7N64',90,{job:'transit',holdRole:'hauler'})
Object.values(Game.creeps).forEach(x=>x.memory.fief = 'W32N27')
 */
var roleBandit = {
    run: function(creep) {
        let res = -99;
        let targetRoom = creep.memory.targetRoom;
        let targetStealID = creep.memory.target;
        let lootTarget = targetStealID && Game.getObjectById(targetStealID);
        let homeTarget = Game.rooms[creep.memory.fief].storage ? Game.rooms[creep.memory.fief].storage : new RoomPosition(25,25,creep.memory.fief)
        //Need a way to exclude ramparted things
        creep.respawn()
        if(creep.store.getFreeCapacity()){
            if(creep.room.name == targetRoom){
                if(!lootTarget || lootTarget.store.getUsedCapacity(Object.keys(lootTarget.store)[0]) == 0){
                    if(creep.room.controller.safeMode){
                        console.log("Thief room safemoded, changing to hauler");
                        creep.memory.role = 'hauler';
                        return;
                    }
                    let loot = creep.room.find(FIND_STRUCTURES).filter(str=>
                        [STRUCTURE_CONTAINER,STRUCTURE_SPAWN,STRUCTURE_EXTENSION,
                            STRUCTURE_LAB,STRUCTURE_TOWER,STRUCTURE_STORAGE].includes(str.structureType) &&
                        str.store.getUsedCapacity(Object.keys(str.store)[0])
                    );
                    console.log("LOOT FOUND",loot)
                    if(loot.length){
                        let lootTarget = creep.pos.findClosestByPath(loot);
                        console.log("Target",lootTarget)
                        creep.memory.target = lootTarget.id;
                    }
                }
                if(lootTarget){
                    console.log("MOVING TOLOOT",lootTarget,creep.pos.getRangeTo(lootTarget))
                    if(creep.pos.getRangeTo(lootTarget) == 1){
                        res = creep.withdraw(lootTarget,Object.keys(lootTarget.store)[0]);
                        console.log("LOOTING",res)
                        creep.travelTo(homeTarget);
                    }
                    else(creep.travelTo(lootTarget))
                }
            }   
            else{
                if(lootTarget){
                    if(creep.pos.getRangeTo(lootTarget) > 1){
                        creep.travelTo(lootTarget)  
                    }
                    else{
                        res = creep.withdraw(lootTarget,Object.keys(lootTarget.store)[0]);
                        console.log("LOOTING",res)
                        creep.travelTo(homeTarget);
                    }
                }
                else creep.travelTo(new RoomPosition(25,25,targetRoom));
                return;
            }
        }
        else{
            let storage = Game.rooms[creep.memory.fief].storage;
            if(storage){
                if(creep.pos.getRangeTo(storage) == 1){
                    creep.transfer(storage,Object.keys(creep.store)[[0]]);
                }
                else{
                    creep.travelTo(storage);
                }
            }
            else{
                creep.travelTo(homeTarget);
            }
        }
        
    }   
}

module.exports = roleBandit;

