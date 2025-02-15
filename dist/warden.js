const profiler = require('screeps-profiler');
const helper = require('functions.helper');
//Siege defense manager.
function Warden(room) {
    this.roomName = room.name;
    this.towerMap = helper.getTowerMap(room);
    this.rampartPlan = Memory.kingdom.fiefs[room.name].rampartPlan;
    this.rampSafe = checkRamps(room,Memory.kingdom.fiefs[room.name].rampartPlan);
    this.defenseMap = getDefenseMap(room,Memory.kingdom.fiefs[room.name].rampartPlan);
};

Warden.prototype.run = function(hostiles) {
    let room = Game.rooms[this.roomName];
    let ramps = room.find(FIND_MY_STRUCTURES).filter(str => str.structureType == STRUCTURE_RAMPART);
    
    //Check if we need to fire safemode due to rampart break or structure damage.
    if(this.rampSafe && ramps.length != this.rampartPlan.length) console.log("FIRING SAFE MODE - Missing Rampart",this.roomName)//room.controller.activateSafeMode();
    let keyStructs = room.find(FIND_MY_STRUCTURES).filter(str => [STRUCTURE_SPAWN,STRUCTURE_STORAGE,STRUCTURE_EXTENSION,STRUCTURE_TOWER,STRUCTURE_LAB,STRUCTURE_TERMINAL].includes(str.structureType) && str.hits < str.hitsMax);
    if(keyStructs.length) console.log("FIRING SAFE MODE - Damaged Key Structure",this.roomName)//room.controller.activateSafeMode();
    console.log("WARDEN ACTIVE")
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
    Memory.test.testCM = walkCM.serialize();
    return walkCM;
}

//Checks to see if there are as many live ramps as planned.
function checkRamps(room,rampPlan){
    let ramps = room.find(FIND_MY_STRUCTURES).filter(str => str.structureType == STRUCTURE_RAMPART);
    return ramps.length == rampPlan.length;
}

module.exports = Warden;