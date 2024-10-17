//Imports
const helper = require('functions.helper'); //Helper functions
require('constants')
require('packrat')
require('prototypes.room');
require('prototypes.creep');
require('prototypes.spawn');
require('prototypes.roomposition');
require('prototypes.military');
require('functions.global');
const supplyDemand = require('supplyDemand')
global.chronicle = require('chronicle');
const spinup = require('spinup')
const kingdomManager = require('kingdomManager'); //Top level kingdom manager system
const Traveler = require('Traveler');
const profiler = require('screeps-profiler');
const fiefPlanner = require('fiefPlanner')
//profiler.enable();
console.log("<font color='yellow'>", Game.shard.name, ": global reset</font>");

//Set Memory reference for building numbers


//Set scoring weights for room planning
Memory.lastReset = 0 || Memory.globalReset;
Memory.globalReset = Game.time;
module.exports.loop = function () {
    profiler.wrap(function() {
    if (hasRespawned() || !Memory.kingdom){
        spinup.run();
    }
    //Reset movement
    Traveler.resetMovementIntents();
    //Check for global reset and action accordingly
    if(Game.time == Memory.globalReset){
        console.log("Global reset!")
        global.reset = true;
        //Segment 0 is for scout data
        //Segment 1 is for room plans
        //Segment 2 is for cached paths
        //Segment 8 is for standardized logging
        //Segment 9 is for ad-hoc logging
        RawMemory.setActiveSegments([0,1,2,3,4,5,6,7,8,9])
        //Global heap
        global.heap = {fiefs:{},alarms:{},stock:{},kingdomStatus:{fiefs:{},holdings:{},wares:{}},granary:{},registry:{},missions:{},army:{troupes:[],lances:{},reserve:[]},funnelTarget:null};
        /*for(let fief in Memory.kingdom.fiefs){
            global.heap.fiefs[fief] = {};
        }
        for(let holding in Memory.kingdom.holdings){
            global.heap.holdings[holding] = {}
        }*/
    }
    //If no reset, do stuff with segments
    else{
        global.reset = false;
        if(Memory.trailingCPU){
            let cpuUte = Memory.trailingCPU.reduce((total, perTick) => {
                return total + perTick.cpu;
            }, 0);
            global.cpuAverage = Math.round(cpuUte/Memory.trailingCPU.length)
        }
        
        let roomData = RawMemory.segments[SEGMENT_ROOM_PLANS]
        if(roomData == "")  RawMemory.segments[SEGMENT_ROOM_PLANS] = "{}"
        if(!global.heap.scoutData){
            let scoutData = RawMemory.segments[SEGMENT_SCOUT_DATA];
            if(scoutData == ""){
                global.heap.scoutData = {}
            }
            else{
                global.heap.scoutData = {} = JSON.parse(scoutData)
            }
        }
        else{    
            //If scout data changed,record it to the segment. Check every 100 ticks
            if(Game.time % 100 == 0 && global.heap.newScoutData){
                console.log("--!!!Updating scout data!!!--")
                try{
                    RawMemory.segments[SEGMENT_SCOUT_DATA] = JSON.stringify(global.heap.scoutData)
                    global.heap.newScoutData = false;
                }
                catch(error){
                    console.log("CAUGHT AND MOVING ON")
                    console.log(error)
                }
            }
        }
    }

    //Check fiefs 
    for(const room in Game.rooms){
        let myRoom = Game.rooms[room];
        if(myRoom)setScoutData(myRoom)
        if(myRoom.controller && myRoom.controller.my){
            if(!Memory.kingdom.fiefs[myRoom.name]){
                Memory.kingdom.fiefs[myRoom.name] = {};
                
            }
            if(!global.heap.fiefs[myRoom.name]){
                global.heap.fiefs[myRoom.name] = {};
            }
        }
    }

    //Garbage collection
    if(Game.time % 100 === 0){
        //Every 100 ticks clear creep memory
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
        
    if(Game.time % 1000 === 0){
        purgeOldScoutData()
        //Every 1000 ticks clear room memory
        //Compile list of rooms to keep
        let keepRooms = [
            ...Object.keys(Memory.kingdom.fiefs),
            ...Object.keys(Memory.kingdom.holdings),
        ];
        let deadRooms = [];
        for(var name in Memory.rooms) {
            if(!keepRooms.includes(name)){
                delete Memory.rooms[name];
                deadRooms.push(name);
            }
        }
        if(deadRooms.length > 0) console.log('Clearing unneeded room data:',deadRooms);
    }


        if(Memory.testRPVisuals){
            //Flood Fill Section
            //Wall Groups
            /*let groups = Object.keys(Memory.test4)
            groups.forEach((each) =>{
                let wallGroup = Memory.test4[each]
                //console.log(JSON.stringify(wallGroup))
                wallGroup.forEach(spot =>{
                    new RoomVisual().circle(spot.x,spot.y,{fill:'black'});
                });
            });
            //Perimeter tiles
            let perimeterTiles = Object.keys(Memory.test6);
            let totalGroups = perimeterTiles.length;
            perimeterTiles.forEach((group,index) =>{
                let groupTiles = Memory.test6[group];
                let hue = (360 / totalGroups) * index; // Use the full color spectrum
                groupTiles.forEach(spot=>{
                    new RoomVisual().circle(spot.x,spot.y,{fill: `hsl(${hue}, 100%, 50%)`});
                })
            })*/
            //Combined exit and controller fill
            //Combined scores in Memory.test9
            /*let cCM = PathFinder.CostMatrix.deserialize(Memory.test9);
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = cCM.get(x,y);
                    if(weight == 0) continue;
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${cCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/
            //Core location selection
            //new RoomVisual().circle(Memory.test10.x,Memory.test10.y,{fill:'red',radius:0.5});
            let roomVis =  new RoomVisual();
            let basePlanCM = PathFinder.CostMatrix.deserialize(Memory.testBasePlanCM);
            //let mnCM = PathFinder.CostMatrix.deserialize(Memory.minCutCM);
            let mnResult;




            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = basePlanCM.get(x,y);
                    
                    if(weight == 0) continue;
                    //new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        //fill: `hsl(${200}${basePlanCM.get(x, y) * 10}, 100%, 60%)`,
                        //opacity: 0.4,
                    //})
                    
                    if(Memory.roomPlanReference[weight] && weight == 99) roomVis.structure(x,y,Memory.roomPlanReference[weight]);
                    //new RoomVisual().text(basePlanCM.get(x,y),x,y+0.25)
                    //new RoomVisual().text(weight,x,y+0.25);
                }
            }
            if(Memory.testBasePlan && Memory.testBasePlan.ramparts){
                mnResult = Memory.testBasePlan.ramparts;
                //let midPoint = Memory.test3;
                mnResult.forEach(spot =>{
                    
                    roomVis.structure(spot.x,spot.y,STRUCTURE_ROAD);

                });
            }
            roomVis.connectRoads();
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = basePlanCM.get(x,y);
                    
                    if(weight == 0) continue;
                    //new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        //fill: `hsl(${200}${basePlanCM.get(x, y) * 10}, 100%, 60%)`,
                        //opacity: 0.4,
                    //})
                    
                    if(Memory.roomPlanReference[weight] && weight != 99) roomVis.structure(x,y,Memory.roomPlanReference[weight]);
                    //new RoomVisual().text(basePlanCM.get(x,y),x,y+0.25)
                    //new RoomVisual().text(weight,x,y+0.25);
                }
            }
            if(mnResult){
                mnResult.forEach(spot =>{
                    

                    new RoomVisual().circle(spot.x,spot.y,{fill:'green',radius:0.5});
                });
    
            }
            if(global.fiefPlanner && global.fiefPlanner.stage == 0){
                let rclPlan = Memory.testRCLPlan;
                for(let rcl in rclPlan){
                    for(let struct in rclPlan[rcl]){
                        for(each of rclPlan[rcl][struct]){
                            new RoomVisual().text(rcl,each.x,each.y+0.25,{font:0.3,stroke:'black'})
                        }
                    }
                }
            }

            
            if(Memory.scoreVisuals){
                let scoreCM = PathFinder.CostMatrix.deserialize(Memory.testScoreFloodCM);
                for (let x = 0; x <= 49; x += 1) {
                    for (let y = 0; y <= 49; y += 1) {
                        let weight = scoreCM.get(x,y);
                        new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                            fill: `hsl(${200}${scoreCM.get(x, y) * 10}, 100%, 60%)`,
                            opacity: 0.4,
                        })
                        new RoomVisual().text(weight,x,y+0.25)
                    }
                }
            }




            


            if(Memory.testScoreTracker){
                let tLine = 0;
                let totalScore = 0;
                for([key,value] of Object.entries(Memory.testScoreTracker)){
                    new RoomVisual().text(key+': '+value,42,3+tLine,{font:1});
                    totalScore += value;
                    tLine++;
                }
                new RoomVisual().text('Total: '+totalScore,42,3+tLine,{font:1});
            }
            
        }

        if(Memory.testModuleVisuals){

            //Remote road visuals

            //One route per gametime for standard 2 source, 1 controller room
            let tickMod = Memory.testModule.routeRoad.totalRoutes.length
            
            //Colors
            let colors = {
                0:'red',
                1:'blue',
                2:'pink',
                3:'purple',
                4:'white',
                5:'black',
                6:'teal'
            }
            let displayRoutes = Memory.testModule.routeRoad.totalRoutes

            //console.log(displayRoutes.length)
            //Draw all routes for 1 tick each, then draw selected route for last couple
            
            if(Game.time % (tickMod+3) < tickMod){
                let tickRoute = displayRoutes[Game.time % (tickMod+3)];
                //console.log(Game.time % (tickMod+3))
                tickRoute.forEach(route =>{
                    for(let i = 0; i < route.length-1; i++){
                        const startPos = route[i];
                        const endPos = route[i + 1];
                    
                        // Draw a line between each pair of adjacent positions
                        if(startPos.roomName == endPos.roomName){
                            new RoomVisual(startPos.roomName).line(startPos, endPos, { color: colors[Game.time % (tickMod+3)], width: 0.2 });
                        }
                    }
                });
            }
            else{
                Memory.testModule.routeRoad.combinedShortest.forEach(route =>{
                    for(let i = 0; i < route.length-1; i++){
                        const startPos = route[i];
                        const endPos = route[i + 1];
                    
                            // Draw a line between each pair of adjacent positions
                        if(startPos.roomName == endPos.roomName){
                            new RoomVisual(startPos.roomName).line(startPos, endPos, { color: 'gold', width: 0.2 });
                        }
                        
                    }
                });
            }
            //Orbit Path Visuals
            /*const startColor = { r: 255, g: 0, b: 0 }; // Red
            const endColor = { r: 0, g: 255, b: 0 }; // Green
            //Paths > Orbit > Individual Routes In Orbit > RoomPositions
            //Access each whole orbit
            Memory.testModule.paths.forEach((orbit,index) => {
                //Get paths for each route in the orbit
                let progress = index / (orbit.length - 1); // Calculate progress
                let color = test.interpolateColors(startColor, endColor, progress);
                orbit.forEach(route =>{
                    //Draw on each spot in the route
                    //new RoomVisual(route[0].roomName).poly(route,{fill:`rgb(${color.r},${color.g},${color.b})`});
                    //route.forEach(spot =>{
                        //new RoomVisual(spot.roomName).poly(spot,{fill:`rgb(${color.r},${color.g},${color.b})`});
                    //});
                    for(let i = 0; i < route.length-1; i++){
                        const startPos = route[i];
                        const endPos = route[i + 1];
                
                        // Draw a line between each pair of adjacent positions
                        new RoomVisual(startPos.roomName).line(startPos, endPos, { color: `rgb(${color.r},${color.g},${color.b})`, width: 0.1 });
                    }
                });
            });
            //Draw midpoint
            new RoomVisual(Memory.testModule.room).circle(Memory.testModule.centerX,Memory.testModule.centerY,{color:'blue',radius:0.9})*/
        }

        kingdomManager.run();
        //console.log("CPU Used:",Game.cpu.getUsed().toFixed(2),'/',Game.cpu.limit);

        Traveler.resolveMovement();
        let endCPU = Game.cpu.getUsed();
        //Record CPU utilization over last 100 ticks

        let trailingCPU = Memory.trailingCPU || [];
        trailingCPU = trailingCPU.filter(item =>{
            return Game.time - item.gameTime <= 100;
        })
        trailingCPU.push({cpu:endCPU,gameTime:Game.time});
        Memory.trailingCPU = trailingCPU;
        //If we're room planning, trigger the rest
        //if(!Memory.roomPlanComplete && Memory.testStructureBlobCM){
            //test.generateRoomPlanStage2(Memory.roomPlanRoomName);
        //}

        //If we have a room planner object and we're not in 0 status, check bucket and run planner
        if(global.heap.fiefPlanner && global.heap.fiefPlanner.stage && global.heap.fiefPlanner.stage != 0){
            if(Game.cpu.bucket > 250){
                fiefPlanner.continueFiefPlan();
            }
        }


        if (Game.cpu.bucket == 10000 && ['shard0','shard1','shard2','shard3'].includes(Game.shard.name)) {
            Game.cpu.generatePixel()
            console.log("<font color='green'>", Game.shard.name, "generated pixel.</font>")
        }
    });
}

//Respawn checker by @SemperRabbit
global.hasRespawned = function hasRespawned(){
    // check for multiple calls on same tick    
    if(Memory.respawnTick && Memory.respawnTick === Game.time) {
        return true;
    }

    // server reset or sim
    if(Game.time === 0) {
        Memory.respawnTick = Game.time;
        return true;
    }

    // check for 0 creeps
    for(const creepName in Game.creeps) {
        return false;
    }

    // check for only 1 room
    const rNames = Object.keys(Game.rooms);
    if(rNames.length !== 1) {
        return false;
    }

    // check for controller, progress and safe mode
    const room = Game.rooms[rNames[0]];
    if(!room.controller || !room.controller.my || room.controller.level !== 1 || room.controller.progress ||
       !room.controller.safeMode || room.controller.safeMode < SAFE_MODE_DURATION-1) {
        return false;
    }

    // check for 1 spawn
    if(Object.keys(Game.spawns).length !== 1) {
        return false;
    }

    // if all cases point to a respawn, you've respawned
    console.log("True due to passing all checks")
    Memory.respawnTick = Game.time;
    return true;
}

//Global functions
//Spawn creep
global.addCreep = function addCreep(room,name,body,memory,severity = 3){
    let newName = name+' '+helper.getName()+' of House '+room;
    Memory.kingdom.fiefs[room].spawnQueue[newName] = {sev:severity,body:body,memory:memory}
}
global.addHolding = function addHolding(room,standby=false,homeRoom=null){
    //Reject if I've screwed up and set a fief or doubled up a holding
    if(Memory.kingdom.fiefs[room] || Memory.kingdom.holdings[room]) return -1;
    let pick;
    let pickNum = 99;
    //If no homeroom provided, loop through fiefs and find the closest room. Linear should generally work.
    if(homeRoom == null){
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            let dist = Game.map.getRoomLinearDistance(room, fief);
            if(dist < pickNum){
                pick = fief;
                pickNum = dist;
            }
        });
        Memory.kingdom.holdings[room] = {homeRoom:pick,standby:standby};
    }else{
        //Else use the homeroom provided
        Memory.kingdom.holdings[room] = {homeRoom:homeRoom,standby:standby};
    }
    
}
global.standby = function standby(holding){
    //Flip standby flag
    Memory.kingdom.holdings[holding].standby = !Memory.kingdom.holdings[holding].standby
    //Clear spawn queue of homeroom to remove holding creeps
    clearQueue(Memory.kingdom.holdings[holding].homeRoom);
}
global.clearQueue = function clearQueue(room='all'){
    if(room == 'all'){
        Object.keys(Memory.kingdom.fiefs).forEach(fief =>{
            Memory.kingdom.fiefs[fief].spawnQueue = {};
        });
    }else{
        Memory.kingdom.fiefs[room].spawnQueue = {};
    }
}
global.getDistance = function getDistance(pos1,pos2){
    let route = PathFinder.search(pos1,{pos:pos2,range:1},{
        maxOps:20000,
        maxRooms:64,
        roomCallback: function(roomName) {
      
            let room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix;    
            if (room){
              room.find(FIND_STRUCTURES).forEach(function(struct) {
                  if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                  } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !struct.my)) {
                    costs.set(struct.pos.x, struct.pos.y, 255);
                  }
                });
            }
            return costs;
          },
    });
    let dist = route.path.length;
    let incomp = route.incomplete;
    return [dist,incomp]
}

function recursiveMemoryProfile(memoryObject, sizes, currentDepth) {
    for (const key in memoryObject) {
        if (currentDepth == 0 || !_.keys(memoryObject[key]) || _.keys(memoryObject[key]).length == 0) {
            sizes[key] = JSON.stringify(memoryObject[key]).length;
        } else {
            sizes[key] = {};
            recursiveMemoryProfile(memoryObject[key], sizes[key], currentDepth - 1);
        }
    }
}

function profileMemory(root = Memory, depth = 1) {
    const sizes = {};
    console.log(`Profiling memory...`);
    const start = Game.cpu.getUsed();
    recursiveMemoryProfile(root, sizes, depth);
    console.log(`Time elapsed: ${Game.cpu.getUsed() - start}`);
    RawMemory.segments[SEGMENT_LOGGING_OTHER] = JSON.stringify(sizes, undefined, '\t');
}

global.purgeOldScoutData = function purgeOldScoutData(amt = 20000){
    let data = global.heap && global.heap.scoutData;
    if(!data) return false;
    for(let [room,roomData] of Object.entries(getScoutData())){
        if(Game.time - roomData.lastRecord > amt) removeScoutData(room)
    }
    RawMemory.segments[SEGMENT_SCOUT_DATA] = JSON.stringify(global.heap.scoutData)
    global.heap.newScoutData = false;
}

global.profileMemory = profileMemory;
//#endregion
addHolding = profiler.registerFN(addHolding, 'addHolding');
