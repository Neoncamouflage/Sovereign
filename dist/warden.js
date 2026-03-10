const profiler = require('screeps-profiler');
const helper = require('functions.helper');
//Siege defense manager.
function Warden(room) {
    this.roomName = room.name;
    this.towerMap = helper.getTowerMap(room);
    this.rampartPlan = Memory.kingdom.fiefs[room.name].rampartPlan;
    this.defenseMap = getDefenseMap(room,Memory.kingdom.fiefs[room.name].rampartPlan);
    this.lastActive = Game.time;
    this.firstActive = Game.time;
    chronicle.log(`Warden activated in ${room.name}.`,'Warden',3);
};

Warden.prototype.run = function(hostiles,fiefCreeps) {
    this.lastActive = Game.time;
    let room = Game.rooms[this.roomName];
    let ramps = []
    let towers = []
    let damagedKeyStructs = false;
    let [hostileDamage, hostileHeal,friendlyDamage,friendlyHeal] = [new BigCostMatrix(),new BigCostMatrix(),new BigCostMatrix(),new BigCostMatrix()]
    //Gather all needed structures, check for damage on key structures
    for(let each of room.find(FIND_MY_STRUCTURES)){
        let type = each.structureType;
        if(type == STRUCTURE_RAMPART){
            ramps.push(each);
            continue;
        }
        if(type == STRUCTURE_TOWER){
            towers.push(each);
            if(each.hits < each.hitsMax)damagedKeyStructs = true;
            continue;
        }
        if([STRUCTURE_SPAWN,STRUCTURE_STORAGE,STRUCTURE_EXTENSION,STRUCTURE_LAB,STRUCTURE_TERMINAL].includes(type) && each.hits < each.hitsMax){
            damagedKeyStructs = true;
        }
    }

    //Check if we need to fire safemode due to rampart break or structure damage.
    if(ramps.length != this.rampartPlan.length) room.controller.activateSafeMode();
    if(damagedKeyStructs) room.controller.activateSafeMode();

    //Gather all defensive creeps
    let guards = [
        ...(fiefCreeps['man-at-arms'] || []),
        ...(fiefCreeps.guardsman || [])
      ];

    //Get current hostile damage/heal maps and total demo power
    //For move/tough, can add those to the hostile creep object. creep.moveScore and creep.toughScore
      
    //Get current friendly damage/heal maps

};

//Generates a map indicating walkable areas, ramparts, and danger zones
function getDefenseMap(room,rampSpots){
    let walkCM = new PathFinder.CostMatrix;
    let queue = room.find(FIND_EXIT);
    let terrain = room.getTerrain();
    let rampSet = new Set();
    let visited = new Set();
    for(let ramp of rampSpots){
        rampSet.add(`${ramp.x},${ramp.y}`)
    }
    for(let exit of queue){
        visited.add(`${exit.x},${exit.y}`)
    };
    //Floodfill to get danger spots
    while(queue.length){
        let spot = queue.pop();
        for(let x = -1;x<=1;x++){
            for(let y = -1;y<=1;y++){
                let newX = spot.x+x;
                let newY = spot.y+y;
                let key = `${newX},${newY}`
                if(visited.has(key)) continue;
                visited.add(key);
                if(newX>49||newY>49||newX<0||newY<0) continue;
                if(terrain.get(newX,newY)==TERRAIN_MASK_WALL) continue;
                if(rampSet.has(key)) continue;
                queue.push({x:newX,y:newY})
                walkCM.set(newX,newY,255);
            }
     
        }
    }
    //Spots 
    if(!Memory.test) Memory.test = {}
    Memory.test.testCM = walkCM.serialize();
    return walkCM;
}

module.exports = Warden;
getDefenseMap = profiler.registerFN(getDefenseMap, 'getDefenseMap');
profiler.registerClass(Warden, 'Warden');