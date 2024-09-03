const helper = require('functions.helper');
var roleBait = {
    //[MOVE,MOVE,CARRY,CARRY,MOVE,ATTACK,MOVE,ATTACK]
    /** @param {Creep} creep **/
    run: function(creep) {
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
        let targetRoom = creep.memory.targetRoom || 'W20S0'
        if(creep.memory.job == 'gopher'){
            creep.travelTo(new RoomPosition(36,44,targetRoom))
            if(creep.room.name == targetRoom){
                if(!Memory.season) Memory.season = {}
                if(!Memory.season.scoreCollectors) Memory.season.scoreCollectors = {}
                if(!Memory.season.scoreCollectors[creep.room.name]){
                    let walls  = creep.room.find(FIND_STRUCTURES).filter(struct => struct.structureType == STRUCTURE_WALL)
                    let collector = creep.room.find(FIND_SCORE_COLLECTORS)[0]
                    if(!collector) return
                    let maxWallHits = 0;
                    walls.forEach(w => {if(w.hits > maxWallHits)maxWallHits = w.hits});
                    let costMatrix = new PathFinder.CostMatrix();
                    console.log("WALLS",walls)
                    for (let wall of walls) {
                        let cost = mapWallHitsToCost(wall.hits);
                        costMatrix.set(wall.pos.x, wall.pos.y, cost);
                    }
                    
                    let route = PathFinder.search(creep.pos, { pos: collector.pos, range: 1 }, {
                        plainCost: 0,
                        swampCost: 0,
                        maxOps: 2000,
                        maxRooms: 1,
                        roomCallback: function(roomName){
                            return costMatrix
                        }
                    }).path;
                    console.log("PATH",route)



                    let targetWalls = []
                    let totalHits = 0;
                    for(let spot of route){
                        let look = creep.room.lookForAt(LOOK_STRUCTURES,spot).filter(struct => struct.structureType == STRUCTURE_WALL);
                        console.log("LOOK",look)
                        if(look.length){
                            targetWalls.push(spot);
                            totalHits += look[0].hits
                        }
                    }

                    Memory.season.scoreCollectors[creep.room.name] = {
                        costMatrix: costMatrix.serialize(),
                        targetWalls: targetWalls,
                        totalHits : totalHits
                    }

                    function mapWallHitsToCost(wallHits,maxWallHits) {
                        return Math.min(254, Math.floor((wallHits / maxWallHits) * 254));
                    }
                }
            }
        }
        if(creep.store.getFreeCapacity() > 0){
            if(creep.room.name != targetRoom){
                creep.travelTo(new RoomPosition(25,25,targetRoom));
                return;
            }
            let targets = creep.room.find(FIND_HOSTILE_CREEPS)
                .filter(crp => crp.store.getUsedCapacity() > 0)
                .sort((a, b) => a.store.getFreeCapacity() - b.store.getFreeCapacity());
            if(!targets.length) return;
            let target = targets[0]

            if(target.store.getFreeCapacity() < 200){
                creep.travelTo(target);
                creep.rangedAttack(target);
                creep.attack(target);
                for (let direction of directions) {
                    const pos = new RoomPosition(
                        creep.pos.x + direction.x,
                        creep.pos.y + direction.y,
                        creep.room.name
                    );
                
                    const resources = pos.lookFor(LOOK_RESOURCES);
                
                    if (resources.length > 0) {
                        creep.pickup(resources[0]);
                        break;  // Pick up the first resource found and exit the loop
                    }
                }
            }
            else{
                creep.travelTo(target)
            }

        }
        else{
            if(creep.pos.getRangeTo(Game.rooms[creep.memory.fief].storage > 1)){
                creep.travelTo(Game.rooms[creep.memory.fief].storage);
            }
            else{
                for(let resType in creep.store){
                    creep.transfer(creep.room.storage,resType)
                }
            }
        }
        
    }
};

function drainRoom(creep){
    if(creep.room.name != creep.memory.targetRoom){
        creep.travelTo(new RoomPosition(25,25,creep.memory.targetRoom));
        return;
    }
    if(creep.store[RESOURCE_ENERGY]) creep.drop(RESOURCE_ENERGY)
    let structs = creep.room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (structure) => {
            if (structure.structureType === STRUCTURE_SPAWN && structure.store[RESOURCE_ENERGY] > 50) {
                return true;
            }
            else if(structure.store[RESOURCE_ENERGY] > 0) {
                return true;
            }
            return false;
        }
    });
    let target = creep.pos.findClosestByRange(structs);
    if(creep.pos.getRangeTo(target) == 1){
        creep.withdraw(target,RESOURCE_ENERGY)
    }else{
        creep.travelTo(target)
    }
}

module.exports = roleBait;

