const helper = require('functions.helper');

let posRef = {
    '698f89839ff46d2d65f59cd2':{x:11,y:34,roomName:'W29N38'},
    '698f89839ff46d2d65f59cd3':{x:17,y:43,roomName:'W29N38'}
}

/**
spawnCreep('bait','13m5w3c','W32N27',99,{job:'transit',holdRole:'builder'})
spawnCreep('bait','1p5m','W32N27',98,{job:'jump'})
spawnCreep('bait','13m5w3c','W32N27',97,{job:'transit',holdRole:'builder'})
spawnCreep('bait','13m5w3c','W32N27',96,{job:'transit',holdRole:'builder'})
spawnCreep('bait','4c4m','W32N27',95,{job:'transit',holdRole:'hauler'})

Object.values(Game.creeps).forEach(x=>x.memory.fief = 'W32N27')
 */
var roleBait = {
    run: function(creep) {
        if(creep.memory.job == 'jump'){
            let startPos = new RoomPosition(34,36,'W32N27')
            if(!creep.memory.pathSet){
                if(!creep.pos.isEqualTo(startPos)){
                    creep.travelTo(startPos);
                    return;
                }
                creep.memory._trav = {
                    path:getSerializedPath(startPos,Memory.test.testPath.slice(1))
                }
                creep.memory.pathSet = true;
            }
            let tPos = new RoomPosition(41,27,'W29N38');
            creep.travelTo(tPos,{swampCost:1,plainsCost:1});
            if(creep.pos.isEqualTo(tPos)){
                let og = Game.rooms.W32N27;
                if(og && og.controller && og.controller.my){
                    og.controller.unclaim()
                }
                creep.claimController(creep.room.controller);
            }
            return;
        }
        if(creep.memory.job == 'transit'){
            if(creep.room.name != 'W29N38'){
                creep.travelTo(new RoomPosition(17,36,'W29N38'),{plainsCost:1,swampCost:1})
            }
            else if(Memory.kingdom.fiefs['W29N38']){
                creep.memory.role = creep.memory.holdRole;
                creep.memory.fief = 'W29N38';
            }
            else{
                creep.travelTo(new RoomPosition(17,36,'W29N38'),{plainsCost:1,swampCost:1})
            }
            return;
        }

        
        let can = creep.memory.can ? Game.getObjectById(creep.memory.can) : null;
        if(!heap.jumpRef) heap.jumpRef = {};
        const directions = [
            { x: 0, y: -1 },  // Top
            { x: 1, y: -1 },  // Top-right
            { x: 1, y: 0 },   // Right
            { x: 1, y: 1 },   // Bottom-right
            { x: 0, y: 1 },   // Bottom
            { x: -1, y: 1 },  // Bottom-left
            { x: -1, y: 0 },  // Left
            { x: -1, y: -1 }  // Top-left
        ];
        if(creep.ticksToLive <= 750 && !creep.memory.backup){
            creep.memory.backup= true;
            spawnCreep('bait','13m5w1c',creep.memory.fief,95,{targetSource:creep.memory.targetSource});
            //spawnCreep('bait','13m5w1c','W32N27',50,{targetSource:'698f89839ff46d2d65f59cd2'})
            //spawnCreep('bait','13m5w1c','W32N27',50,{targetSource:'698f89839ff46d2d65f59cd3'})
        }
        let targetPos = posRef[creep.memory.targetSource];
        let targetSpot = new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName);
        let target = Game.getObjectById(creep.memory.targetSource);
        if(!target || creep.pos.getRangeTo(target) > 1){
            creep.travelTo(targetSpot);
        }
        else{
            if(target.energy && target.energy > 0){
                creep.harvest(target);
            }
            else if(can){
                if(can.hits < can.hitsMax * 0.3){
                    creep.repair(can);
                    creep.repping = true;
                    let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                    //Pickup loose energy if available, otherwise withdraw
                    if(resSpot.length) creep.pickup(resSpot[0])
                    else{
                        creep.withdraw(can,RESOURCE_ENERGY);
                    }
                    
                }
            }
            else{
                let cSite = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES,creep.pos)
                if(!cSite.length){
                    let canSpot = creep.room.lookForAt(LOOK_STRUCTURES,creep.pos)
                    if(canSpot.length){
                        for(let struct of canSpot){
                            if(struct.structureType == STRUCTURE_CONTAINER) creep.memory.can = struct.id;
                        }
                        
                    }
                    else{
                        creep.room.createConstructionSite(creep.pos,STRUCTURE_CONTAINER) 
                    }
                }
                else if(creep.pos.isEqualTo(targetSpot)){
                    creep.build(cSite[0])
                    creep.repping = true;
                    let resSpot = creep.room.lookForAt(LOOK_RESOURCES,creep.pos).filter(res => res.resourceType == RESOURCE_ENERGY);
                    //Pickup loose energy if available, otherwise withdraw
                    if(resSpot.length) creep.pickup(resSpot[0])
                }
            }
        }
        
        
    }        
}

module.exports = roleBait;

