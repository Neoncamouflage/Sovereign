const registry = require('registry');
const helper = require('functions.helper');
const intelManager = {
    run: function(scouts,fiefs){
        let scoutData = global.heap.scoutData;
        const SCOUT_MAX = 3;
        if(!scouts || !fiefs) return;
        //If we have no scouts, order one
        if(Game.time % 3 == 0){
            //1 scout per fief untl 3
            if(scouts.length < Math.min(fiefs.length,SCOUT_MAX)){
                let plan = {
                    memory:{
                        sev:20,
                        role:'scout',
                        fief:fiefs[Math.floor(Math.random() * fiefs.length)],
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
                setScoutData(creep.room);
                getExit(creep);
            }
            //Else if we're in a new room, get a new exit or sign target
            else if (creep.room.name !== creep.memory.lastRoom) {
                setScoutData(creep.room);
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
                            creep.travelTo(creep.room.controller);
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
                        creep.travelTo(creep.room.controller);
                    }
                    else{
                        creep.signController(creep.room.controller,creep.memory.signMessage)
                        delete creep.memory.signMessage
                    }
                }
                

            }
            else if(creep.memory.exitTarget){
                let mem = creep.memory.exitTarget;
                creep.travelTo(new RoomPosition(mem.x,mem.y,mem.roomName),{allowHostile:false})
            }
            else{
                console.log("SCOUT",creep.name,"HAVING ISSUES FINDING EXIT")
            }
            
        });

        function getExit(creep){
            let exits = getScoutData(creep.room.name,'exits') || Game.map.describeExits(creep.room.name);
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
                //console.log("Only exit is back the way we came!")
                exitRooms.push(creep.memory.lastRoom);
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
                //Get scout data for all the room options, add their names since that isn't yet part of the object data
                for(let roomOpt of exitRooms){
                    let scout = getScoutData(roomOpt);
                    //Unscouted means we pick you first
                    if(!scout){
                        //console.log(roomOpt,"is unscouted, picking that")
                        roomPick = roomOpt;
                        break;
                    }
                    scout.roomName = roomOpt;
                    if(scout.owner && scout.owner == Memory.me){
                        scout.lastRecord = 0;
                    }
                    //console.log("Pushing",scout.roomName,JSON.stringify(scout))
                    roomOpts.push(scout)
                }
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