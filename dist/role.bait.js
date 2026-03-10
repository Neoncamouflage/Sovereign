const helper = require('functions.helper');

let posRef = {
    '698f8a099ff46d2d65f5b3bd':{x:39,y:37,roomName:'W8N72'},
    '698f8a099ff46d2d65f5b3be':{x:13,y:45,roomName:'W8N72'},
}

/**
spawnCreep('bait','5m1p','W7N64',98,{job:'jump'})
    spawnCreep('bait','6m3w2c','W7N64',91,{job:'transit',holdRole:'builder',targetRoom:'W8N72'})
 SMALL -------- spawnCreep('bait','5m5c','W7N64',90,{job:'transit',holdRole:'hauler',targetRoom:'W8N72'})

//spawnCreep('bait','7m6w1c','W7N64',92,{target:'698f8a099ff46d2d65f5b3bd'})
//spawnCreep('bait','7m6w1c','W7N64',92,{target:'698f8a099ff46d2d65f5b3be'})

spawnCreep('bait','10mc','W7N64',90,{job:'transit',holdRole:'hauler'})
Object.values(Game.creeps).forEach(x=>x.memory.fief = 'W32N27')
 */
var roleBait = {
    run: function(creep) {
        if(creep.memory.job == 'jump'){
            let tPos = new RoomPosition(40,12,'W8N72');
            creep.travelTo(tPos,{maxOps:100000,maxRooms:64,plainCost:1,swampCost:1});
            if(creep.pos.isEqualTo(tPos)){
                /*let og = Game.rooms.W15N61;
                if(og && og.controller && og.controller.my){
                    og.controller.unclaim()
                }*/
                creep.claimController(creep.room.controller);
            }
            return;
        }
        if(creep.memory.job == 'transit'){
            if(creep.room.name != 'W8N72'){
                creep.travelTo(new RoomPosition(27,42,'W8N72'))
            }
            else if(Memory.kingdom.fiefs['W8N72']){
                creep.memory.role = creep.memory.holdRole;
                creep.memory.fief = 'W8N72';
            }
            else{
                creep.travelTo(new RoomPosition(27,42,'W8N72'))
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
        if(creep.memory.target == '698f89839ff46d2d65f59cd2') creep.memory.target = '698f89929ff46d2d65f59e98'
        if(creep.memory.target == '698f89839ff46d2d65f59cd3') creep.memory.target = '698f89929ff46d2d65f59e99'
        if(creep.ticksToLive <= 750 && !creep.memory.backup){
            creep.memory.backup= true;
        }
        if(!creep.memory.target)creep.memory.target = creep.memory.targetSource;
        let targetPos = posRef[creep.memory.target];
        let targetSpot = new RoomPosition(targetPos.x,targetPos.y,targetPos.roomName);
        
        
        let target = Game.getObjectById(creep.memory.target);
        if(!target || creep.pos.getRangeTo(target) > 1){
            creep.travelTo(targetSpot);
        }
        else{
            if(creep.memory.fief != creep.room.name){
                if(targetPos.roomName == creep.room.name){
                    creep.memory.fief = creep.room.name;
                    creep.memory.role = 'harvester';
                    creep.memory.job = 'energyHarvester';
                    creep.memory.harvestSpot = targetPos;
                }
            }
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

