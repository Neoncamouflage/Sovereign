const registry = require('registry');

const intelManager = {
    run: function(scouts,fiefs){
        let scoutData = global.heap.scoutData;
        if(!scouts || !fiefs) return;
        //If we have no scouts, order one
        if(Game.time % 3 == 0){
            //1 scout per fief untl 3
            if(scouts.length < Math.min(fiefs.length,3)){
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
                getExit(creep);
            }
            //Else if we're in a new room, get a new exit
            else if (creep.room.name !== creep.memory.lastRoom) {
                getExit(creep)
                creep.memory.lastRoom = creep.room.name;
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
            let exits = Game.map.describeExits(creep.room.name);
            let exitRooms = Object.values(exits).filter(roomName => roomName !== creep.memory.lastRoom);
            delete creep.memory.exitTarget
            //If the only exit is back the way we came, then add it back
            if (!exitRooms.length && Object.values(exits).includes(creep.memory.lastRoom)) {
                console.log("Only exit is back the way we came!")
                exitRooms.push(creep.memory.lastRoom);
            }
            console.log("GETTING NEW EXIT")
            if (exitRooms.length > 0) {
                let randomRoom = exitRooms[Math.floor(Math.random() * exitRooms.length)];
                console.log("Random exit room is:",randomRoom)
                let exitDir = Object.keys(exits).find(key => exits[key] === randomRoom);
                console.log("EXIT DIR IS",exitDir,typeof(exitDir))
                let exitOpts = creep.room.find(Number(exitDir))
                console.log("EXIT OPTS ARE",exitOpts)
                let exitPos = creep.pos.findClosestByRange(exitOpts);
                console.log("EXIT POS IS",exitPos)
    
                if (exitPos) {
                    creep.memory.exitTarget = {x:exitPos.x,y:exitPos.y,roomName:exitPos.roomName}
                    creep.travelTo(exitPos);
                }
    
                
            }
        }
    }
}

module.exports = intelManager;