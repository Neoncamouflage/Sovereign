const registry = require('registry');
const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const intelManager = {
    run: function(scouts,fiefs){
        let scoutData = global.heap.scoutData;
        const SCOUT_MAX = 3;
        if(!scouts || !fiefs) return;
        //If we have no scouts, order one
        if(Game.time % 3 == 0){
            //1 scout per fief untl 3
            let fiefPick = fiefs[Math.floor(Math.random() * fiefs.length)];
            if(scouts.length < Math.min(fiefs.length*2,SCOUT_MAX)){
                let plan = {
                    sev:(!scouts.length) || Game.rooms[fiefPick].controller.level > 2 ? 40 : 20,
                    memory:{
                        role:'scout',
                        fief:fiefPick,
                    }
                };
                registry.requestCreep(plan)
            }
        }

        //Operate scouts
        this.runScouts(scouts);
    },
    runScouts: function(scouts){
        scouts.forEach(creep=>{
            //Season stuff
            if(Game.shard.name == 'shardSeason'){
                let scoreCheck = creep.room.find(FIND_SCORE_COLLECTORS)
                if(scoreCheck.length){
                    if(!Memory.season) Memory.season = {}
                    if(!Memory.season.scoreCollectors) Memory.season.scoreCollectors = {}
                    if(!Memory.season.scoreCollectors[creep.room.name]){
                        let walls  = creep.room.find(FIND_STRUCTURES).filter(struct => struct.structureType == STRUCTURE_WALL)
                        let collector = scoreCheck[0]
                        let maxWallHits = 0;
                        walls.forEach(w => {if(w.hits > maxWallHits)maxWallHits = w.hits});
                        let costMatrix = new PathFinder.CostMatrix();
                        console.log("WALLS",walls)
                        for (let wall of walls) {
                            let cost = mapWallHitsToCost(wall.hits,maxWallHits);
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
            //If we're freshly spawned, get us an exit and set lastRoom
            if (!creep.memory.lastRoom || !creep.memory.exitTarget) {
                creep.memory.lastRoom = creep.room.name;
                getExit(creep);
            }
            //Else if we're in a new room, get a new exit or sign target
            else if (creep.room.name !== creep.memory.lastRoom) {
                //Check to see if we need to sign the controller
                if(!creep.memory.signMessage){
                    let sign = helper.getSign(creep.room);
                    //If no sign, set data, get exit, and mark this as the last room
                    if(!sign){
                        //console.log("No sign for this room, setting scout data for",creep.room.name)
                        getExit(creep)
                        creep.memory.lastRoom = creep.room.name;
                    }
                    //If we got a sign, make sure we can actually get to it
                    else{
                        let [dist,incomplete] = getDistance(creep.pos,creep.room.controller.pos);
                        //If incomplete, move on with regular logic
                        if(incomplete){
                            //console.log("Path to controller is blocked, getting exit and setting scout data for",creep.room.name)
                            getExit(creep)
                            creep.memory.lastRoom = creep.room.name;
                        }
                        //Otherwise we set the signMessage and start pathing.
                        else if(creep.pos.getRangeTo(creep.room.controller) > 1){
                            creep.memory.signMessage = sign;
                            creep.travelTo(creep.room.controller,{maxRooms:1});
                        }
                        else{
                            creep.memory.signMessage = sign;
                            //Delete sign message. Next tick on trying to get a sign, it'll fail due to us already marking it
                            creep.signController(creep.room.controller,creep.memory.signMessage)
                            delete creep.memory.signMessage
                        }
                    }
                }
                else if(Memory.kingdom.fiefs[creep.room.name]){
                    delete creep.memory.signMessage
                }
                //Else if we already know we need to sign the controller, do so
                else{
                    if(creep.pos.getRangeTo(creep.room.controller) > 1){
                        creep.travelTo(creep.room.controller,{maxRooms:1});
                    }
                    else{
                        creep.signController(creep.room.controller,creep.memory.signMessage)
                        delete creep.memory.signMessage
                    }
                }
                

            }
            else if(creep.memory.exitTarget){
                let mem = creep.memory.exitTarget;
                creep.travelTo(new RoomPosition(mem.x,mem.y,mem.roomName),{maxRooms:1})
            }
            else{
                console.log("SCOUT",creep.name,"HAVING ISSUES FINDING EXIT")
            }
            
        });

        function getExit(creep){
            let exits = Game.map.describeExits(creep.room.name);
            //console.log("Viable exits:",JSON.stringify(exits))
            let exitRooms = Object.values(exits).filter(roomName => {
                //If it's on the no scout list, deny
                if(Memory.noScout && Memory.noScout.includes(roomName)) return false;
                let roomData = getScoutData(roomName);
                //If it's our last room, deny
                if(creep.memory.lastRoom == roomName) return false;
                //If we're just crossing into another one of our fiefs, deny
                if(Memory.kingdom.fiefs[roomName]) return false;
                //If no data, it's good to scout
                if(!roomData) return true;
                //Only consider the room good if it isn't a fief belonging to an enemy, or if it is, if it's been longer than 20k ticks since we looked in on it
                let good = (roomData.roomType != 'fief' || roomData.ownerType != 'enemy') || Game.time - roomData.lastRecord > 5000;
                return good;
            });
            //console.log("Viable exits after trimming:",exitRooms)

            delete creep.memory.exitTarget
            //If the only exit is back the way we came, then add it back
            if (!exitRooms.length) {
                //if the exit room is the current room, just push all exits, probably trapped in the fief
                if(creep.memory.lastroom == creep.room.name){
                    exitRooms = exits;
                }
                else{
                    exitRooms.push(creep.memory.lastRoom);
                }
                
            }
            //console.log("GETTING NEW EXIT")
            let roomPick;
            //If only one option, just pick that.
            if(exitRooms.length == 1){
                //console.log("Only one option:",exitRooms[0])
                roomPick = exitRooms[0]
            }
            //Else, prefer unscouted rooms. If all scouted, prefer longest time since scouting.
            else{
                let roomOpts = [];
                let unscouted = [];
                //Get scout data for all the room options, add their names since that isn't yet part of the object data
                for(let roomOpt of exitRooms){
                    let scout = getScoutData(roomOpt);
                    //Unscouted means we pick you first
                    if(!scout){
                        //console.log(roomOpt,"is unscouted, picking that")
                        unscouted.push(roomOpt)
                    }
                    scout.roomName = roomOpt;
                    if(scout.owner && scout.owner == Memory.me){
                        scout.lastRecord = 0;
                    }
                    //console.log("Pushing",scout.roomName,JSON.stringify(scout))
                    roomOpts.push(scout)
                }
                //If unscouted, get a random one or, if only 1, then the one option
                if(unscouted.length) roomPick = unscouted[Math.floor(Math.random() * unscouted.length)];
                //If we found one already, use that, otherwise continue
                if(!roomPick){
                    console.log("No roompick, finding oldest of",JSON.stringify(roomOpts))
                    let highest = 0;
                    for(let scoutRoom of roomOpts){
                        //console.log(JSON.stringify(scoutRoom))
                        //console.log(`${scoutRoom.roomName}:${Game.time - scoutRoom.lastRecord} vs high count of ${highest}`)
                        if(Game.time - scoutRoom.lastRecord > highest){
                            roomPick = scoutRoom.roomName;
                            highest = Game.time - scoutRoom.lastRecord; 
                        }
                    }
                    //console.log("Highest score is",highest)
                    if(highest == 0){
                        roomPick = roomOpts[Math.floor(Math.random() * roomOpts.length)].roomName;
                        //console.log("Random pick is",roomPick)
                    }
                    //console.log("Picked",JSON.stringify(highest))
                   // console.log("Scouting",roomPick,"due to it being the oldest")
                }
                
            }
            //Now we path to the exit
            let exitDir = Object.keys(exits).find(key => exits[key] === roomPick);
            //console.log("EXIT DIR IS",exitDir,typeof(exitDir))
            let exitOpts = creep.room.find(Number(exitDir))
            //console.log("EXIT OPTS ARE",exitOpts)
            let exitPos = creep.pos.findClosestByRange(exitOpts);
            //console.log("EXIT POS IS",exitPos)

            if (exitPos) {
                creep.memory.exitTarget = {x:exitPos.x,y:exitPos.y,roomName:exitPos.roomName}
                creep.travelTo(exitPos);
            }
        }
    }
}

module.exports = intelManager;
profiler.registerObject(intelManager, 'intelManager');