const registry = require('registry');
const helper = require('functions.helper');
const profiler = require('screeps-profiler');
const closedRooms = new Set();
const intelManager = {
    toScout:[],
    run: function(scouts,fiefs){
        let scoutList = heap && heap.scoutList || {}//{scoutRoom:requestingFief}
        const SCOUT_MAX = 7;
        if(!scouts || !fiefs) return;
        //If we have no scouts, order one
        if(Game.time % GLOBAL_SPAWN_INTERVAL == 0){
            let fiefpick;
            let fiefLimit = fiefs.length == 1 && Game.rooms[fiefs[0]].controller.level < 3 && Object.keys(scoutList).length ? 10 : Math.min(fiefs.length*2,SCOUT_MAX)
            if(scouts.length < fiefLimit){
                if(Object.keys(scoutList).length){
                    fiefpick = Object.values(scoutList)[0]
                }
                else{
                    fiefpick = fiefs[Math.floor(Math.random() * fiefs.length)];
                }
                let plan = {
                    sev:(scouts.length < 4) && Game.rooms[fiefpick].controller.level <= 2 ? 40 : 20,
                    memory:{
                        role:'scout',
                        fief:fiefpick,
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
                //console.log("MEM",JSON.stringify(mem))
                let exitPos = new RoomPosition(mem.x,mem.y,mem.roomName);
                if(creep.pos.isEqualTo(exitPos)){
                    if(creep.memory.stuckCheck){
                        let roomStatus = Game.map.getRoomStatus(mem.target).status;
                        if(roomStatus == 'closed'){
                            closedRooms.add(mem.target);
                            delete creep.memory.stuckCheck;
                            getExit(creep);
                            
                        }
                    }
                    else{
                        creep.memory.stuckCheck = true;
                    }
                }
                else{
                    if(creep.memory.stuckCheck){
                        delete creep.memory.stuckCheck;
                    }
                }
                creep.travelTo(exitPos,{maxRooms:1})
            }
            else{
                console.log("SCOUT",creep.name,"HAVING ISSUES FINDING EXIT")
            }
            
        });

        function getExit(creep){
            let portals = creep.room.find(FIND_STRUCTURES).filter(str=>str.structureType == STRUCTURE_PORTAL);
            let exits = Game.map.describeExits(creep.room.name);
            let portalRooms = [];
            //console.log("Viable exits:",JSON.stringify(exits))
            if(heap.scoutList && Object.keys(heap.scoutList).length){
                console.log("Scout list found, prioritizing")
                let closest;
                let range = 999;
                for(let each of Object.keys(heap.scoutList)){
                    if(scouts.filter(sct => sct.memory.exitTarget && sct.memory.exitTarget.target == each).length){
                        continue;
                    }
                    let route = Game.map.findRoute(creep.room.name, each);
                    if(route == ERR_NO_PATH) continue;
                    if(route.length < range){
                        range = route.length;
                        closest = route;
                    }
                }
                if(closest){
                    console.log("CLOSEST",JSON.stringify(closest))
                    let exitPos = creep.pos.findClosestByRange(closest[0].exit)
                    creep.memory.exitTarget = {x:exitPos.x,y:exitPos.y,roomName:exitPos.roomName,target:closest[0].room}
                    console.log(closest[0].room,'is closest. Exit pos:',exitPos)
                    creep.travelTo(exitPos);
                    return;
                }
            }
            let exitRooms = Object.values(exits).filter(roomName => {
                //If another scout is already doing it, deny
                if(scouts.filter(sct => sct.memory.exitTarget && sct.memory.exitTarget.target == roomName).length) return false;
                //If it's on the no scout list, deny
                if(Memory.noScout && Memory.noScout.includes(roomName)) return false;
                let roomData = getScoutData(roomName);
                //If it's our last room, deny
                if(creep.memory.lastRoom == roomName) return false;
                //If we're just crossing into another one of our fiefs, deny
                if(Memory.kingdom.fiefs[roomName]) return false;
                //If it's a dead room, deny
                if(closedRooms.has(roomName)) return false;
                //If no data, it's good to scout
                if(!roomData) return true;
                //Only consider the room good if it isn't a fief belonging to an enemy, or if it is, if it's been longer than 20k ticks since we looked in on it
                let good = (roomData.roomType != 'fief' || roomData.ownerType != 'enemy') || Game.time - roomData.lastRecord > 20000;
                return good;
            });
            if(portals.length){
                portalRooms = portals.map(prt => prt.destination.roomName)
                exitRooms.push(...portalRooms)
            }
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
                    //console.log("No roompick, finding oldest of",JSON.stringify(roomOpts))
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
            //Check if it's a portal
            let exitPos;
            if(portalRooms.includes(roomPick)){
                let portalPick = portals.filter(prt => prt.destination.roomName == roomPick)[0].pos;
                creep.memory.exitTarget = {x:portalPick.x,y:portalPick.y,roomName:portalPick.roomName,target:roomPick}
                creep.travelTo(portalPick)
            }
            else{
                let exitDir = Object.keys(exits).find(key => exits[key] === roomPick);
                //console.log("EXIT DIR IS",exitDir,typeof(exitDir))
                let exitOpts = creep.room.find(Number(exitDir))
                //console.log("EXIT OPTS ARE",exitOpts)
                exitPos = creep.pos.findClosestByRange(exitOpts);
                //console.log("EXIT POS IS",exitPos)
                if (exitPos) {
                    creep.memory.exitTarget = {x:exitPos.x,y:exitPos.y,roomName:exitPos.roomName,target:roomPick}
                    creep.travelTo(exitPos);
                }
            }



        }
    }
}

module.exports = intelManager;
profiler.registerObject(intelManager, 'intelManager');