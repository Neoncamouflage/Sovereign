//Imports
const helper = require('functions.helper'); //Helper functions
require('prototypes.room'); //Room prototype extensions
//require('roomVisual');//RV prototypes
//TestReGrunt
const roomPlanner = require('roomPlanner');
const kingdomManager = require('kingdomManager'); //Top level kingdom manager system
const Traveler = require('Traveler');
require('prototypes.creep')
const profiler = require('screeps-profiler');
const mapVisuals = require('mapVisuals');
const fiefPlanner = require('fiefPlanner')
profiler.enable();
console.log("<font color='yellow'>", Game.shard.name, ": global reset</font>");
Memory.roomPlanReference = {
    100:STRUCTURE_RAMPART,
    99:STRUCTURE_ROAD,
    98:STRUCTURE_STORAGE,
    97:STRUCTURE_FACTORY,
    96:STRUCTURE_POWER_SPAWN,
    95:STRUCTURE_LINK,
    94:STRUCTURE_TERMINAL,
    93:STRUCTURE_WALL,
    88:STRUCTURE_TOWER,
    87:STRUCTURE_EXTRACTOR,
    76:STRUCTURE_LAB,
    75:STRUCTURE_LAB,
    60:STRUCTURE_EXTENSION,
    45:STRUCTURE_OBSERVER,
    44:STRUCTURE_NUKER,
    33:STRUCTURE_SPAWN,
    12:STRUCTURE_CONTAINER,
};

Memory.scoreWeights = {
    rampTileWeight:2,
    rampDistWeight:0.2,
    controllerDistWeight:3,
    sourceDistWeight:0.3,
    extensionDistWeight:2,
    extensionMaxWeight:1,
    extensionMissingWeight:8,
    controllerFoundWeight:100,
    sourceFoundWeight:25,
    structureFoundWeight:500
}
Memory.creepTalk = {
    'idle':[
        '💤',

    ]
}
module.exports.loop = function () {
    profiler.wrap(function() {
    //Grunt test 2
    //#ffba4b
    //return;  
    Traveler.resetMovementIntents();
    //Confirm Memory setup
    //console.log("UPDATE")
        if(!Memory.me) Memory.me = 'NeonCamouflage';
        if(!Memory.diplomacy) Memory.diplomacy = {allies:[],vassals:[],agents:{}}
        if(!Memory.kingdom) Memory.kingdom = {};
        if(!Memory.kingdom.holdings) Memory.kingdom.holdings = {};
        if(!Memory.kingdom.settlements) Memory.kingdom.settlements = {};
        if(!Memory.kingdom.fiefs || Object.keys(Memory.kingdom.fiefs).length === 0){
            Memory.kingdom.fiefs = {};
            for(const room in Game.rooms){
                let myRoom = Game.rooms[room];
                if(myRoom.controller && myRoom.controller.my){
                    Memory.kingdom.fiefs[myRoom.name] = {};
                }
            }
        }
        //Global reset
        if(!global.reset){
            global.reset = true;
            global.resetTick = Game.time;
            //Segment 0 is for scout data
            //Segment 1 is for room plans
            RawMemory.setActiveSegments([0,1])
            //Global heap
            global.heap = {fiefs:{},holdings:{}};
            Object.keys(Memory.kingdom.fiefs).forEach(fief =>{
                global.heap.fiefs[fief] = {};
            })
            Object.keys(Memory.kingdom.holdings).forEach(holding =>{
                global.heap.holdings[holding] = {};
            })
            return;
        }
        //scoutSegment = RawMemory.segments[0];

        //roomPlanSegment = RawMemory.segments[1];
        //console.log(JSON.stringify(scoutSegment))
        //Scout data gets pulled from the segment on reset, if no data in the segment, create a new one
        //Scout data otherwise lives in heap and gets written to the segment every so often.
        if(!global.heap.scoutData){
            global.heap.scoutData = JSON.parse(RawMemory.segments[0]);
        }
        else{
            //Record scout data if new
            Object.entries(Game.rooms).forEach(([roomName,room])=>{
                //Record every room at least once, update non-fief rooms only every 200 ticks
                if(!global.heap.scoutData[roomName] || (global.heap.scoutData[roomName].lastRecord < Game.time - 200 && !Memory.kingdom.fiefs[roomName])){
                    //console.log("AYE")
                    let [roomType,ownerType,owner] = helper.getRoomType(room);
                    let sources = room.find(FIND_SOURCES).map(src => {return {x:src.pos.x,y:src.pos.y,id:src.id}})
                    let mineral = room.find(FIND_MINERALS)[0];
                    let towerPositions = room.find(FIND_HOSTILE_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}}).map(tow => {return {x:tow.pos.x,y:tow.pos.y,id:tow.id}});
                    let otherCreeps = room.find(FIND_HOSTILE_CREEPS);
                    //let hostileCreeps = otherCreeps.filter(creep =>{!Memory.diplomacy.allies.includes(creep.owner.username)});
                    //let allyCreeps = otherCreeps.filter(creep =>{Memory.diplomacy.allies.includes(creep.owner.username)});
                    
                    //If the N/S and E/W coords mod 10 are both 5 then it's a center room, otherwise if they're both in the range 4-6 then it's an SK room. 
                    //Maybe use this instead of saving room type
                    global.heap.scoutData[roomName] = {
                        lastRecord : Game.time,
                        roomType: roomType,
                        ownerType: ownerType,
                        owner: ownerType ?  owner : null,
                        controller: room.controller ? {x:room.controller.pos.x,y:room.controller.pos.y} : null,
                        controllerLevel: roomType == 'fief' ? room.controller.level : null,
                        towers: towerPositions,
                        sources: sources,
                        mineral: mineral ? {x:mineral.pos.x,y:mineral.pos.y,type:mineral.mineralType} : null,
                        exits: Game.map.describeExits(roomName),
                    }
                    global.heap.newScoutData = true;
                }
            })

            //If scout data changed,record it to the segment. Check every 100 ticks
            if(Game.time % 100 == 0 && global.heap.newScoutData){
                //console.log("Updating scout data")
                RawMemory.segments[0] = JSON.stringify(global.heap.scoutData)
                global.heap.newScoutData = false;
            }
        }



        if(!Memory.icons){
            console.log("MAKING ICONS")
            Memory.icons = {
                harvester: '⛏️',
                soldier:'👮',
                fastFiller:'✉️',
                remoteDefender:'🛡️',
                guard: '🛡️',
                upgrader:'⏫',
                gunner:'💥',
                boost: '⏫',
                runner: '🚚',
                harvGrader:'⛏️',
                starter:'👶',
                builder:'👷',
                marauder:'🏴‍☠️',
                claimer:'📌',
                dualHarv:'⛏️',
                hauler:'📦',
                lowHauler:'📦',
                trucker:'🛢️',
                generalist:'🚚',
                hunter:'⚔️',
                ranger:'🏹',
                miner:'⛏️',
                diver:'☢️',
                bait:'☢️',
                duo:'👮',
                settler:'🚚',
                manager:'🗃️',
                extractor:'👮',
                scout:'🧭'
            };
        }
        //Check fiefs 
        for(const room in Game.rooms){
            let myRoom = Game.rooms[room];
            if(myRoom.controller && myRoom.controller.my && !Memory.kingdom.fiefs[myRoom.name]){
                Memory.kingdom.fiefs[myRoom.name] = {};
            }
        }
        //No Return
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
            //Every 1000 ticks clear room memory
            //Compile list of rooms to keep
            let keepRooms = [
                ...Object.keys(Memory.kingdom.fiefs),
                ...Object.keys(Memory.kingdom.holdings),
                ...Object.keys(Memory.kingdom.settlements)
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
        //Code separation by shards, for the future
        //console.log(Game.shard.name)
        /*if(Game.shard.name == '8451eb340322' || Game.shard.name == 'shard3'){
            //High level manager runs first
            kingdomManager.run();
            //console.log("Shard3 CPU Used");
            //console.log(Game.cpu.getUsed());
        }*/
        

        //Function calling
        /*
        //--Memory Structure
        //Memory > bunkerPlan
        //Memory > roomPlanning > room#s >  terrainMatrix/roomPlan
        //Memory > kingdom > fiefs/holdings
        //  fiefs > room#s  / holdings > Room#s 
        */
        
        /*
        Managers:
        
        link management inside fief
        militaryManager
        scienceManager
        tradeManager
        trafficManager
        */
        if(Memory.intelVisuals){
            mapVisuals.intel();
        }

        if(Memory.testStruct){
            let roomVis =  new RoomVisual();
            let testStructureBlobCM = PathFinder.CostMatrix.deserialize(Memory.testStructureBlobCM);
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = testStructureBlobCM.get(x,y);
                    if(weight == 0) continue;
                    //new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        //fill: `hsl(${200}${testStructureBlobCM.get(x, y) * 10}, 100%, 60%)`,
                        //opacity: 0.4,
                    //})
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }
        }


        if(Memory.testRPVisuals){
            let startCPU = Game.cpu.getUsed()
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





            //Convex hulls
            /*let hulls = Object.keys(Memory.test5);
            hulls.forEach(hull =>{
                let hullPoints = Memory.test5[hull];
                for(let i = 0; i < hullPoints.length ; i++){
                    if(i+1 == hullPoints.length){
                        new RoomVisual().line(hullPoints[i].x,hullPoints[i].y,hullPoints[0].x,hullPoints[0].y)
                    }
                    else{
                        new RoomVisual().line(hullPoints[i].x,hullPoints[i].y,hullPoints[i+1].x,hullPoints[i+1].y)
                    }
                }
            })*/

            //Defect tiles
            /*let defectGroups = Object.keys(Memory.test7)
            defectGroups.forEach(each =>{
                if(each!=Memory.testPick)return;
                let defectTiles = Memory.test7[each];
                defectTiles.forEach(spot =>{
                    new RoomVisual().circle(spot.x,spot.y,{fill:'white',radius:0.4});
                    new RoomVisual().text(spot.distance,spot.x,spot.y+0.25)
                })
           })*/

           /*let exitCM = PathFinder.CostMatrix.deserialize(Memory.test7);
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = exitCM.get(x,y);
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${exitCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/



            /*let regionCM = PathFinder.CostMatrix.deserialize(Memory.test4);
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = regionCM.get(x,y);
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${regionCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/



            /*let rampCM = PathFinder.CostMatrix.deserialize(Memory.rampartTestCM)
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = rampCM.get(x,y);
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${rampCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/

            /*let sourceCM = PathFinder.CostMatrix.deserialize(Memory.sourceMatrix)
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = sourceCM.get(x,y);
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${sourceCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/

            //Room plan visualization, with structure blob and actual building structures
            /*let testStructureBlobCM = PathFinder.CostMatrix.deserialize(Memory.testStructureBlobCM);

            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = testStructureBlobCM.get(x,y);
                    if(weight == 0) continue;
                    //if(Memory.testStructureBlobCM[weight]) new RoomVisual().text(weight,x,y+0.25)
                    new RoomVisual().text(weight,x,y+0.25)
                    
                }
            }*/
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
                    
                    if(Memory.testRoomPlanReference[weight] && weight == 99) roomVis.structure(x,y,Memory.testRoomPlanReference[weight]);
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
                    
                    if(Memory.testRoomPlanReference[weight] && weight != 99) roomVis.structure(x,y,Memory.testRoomPlanReference[weight]);
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
            /*for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = mnCM.get(x,y);
                    //if(weight == 0) continue;
                    //new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        //fill: `hsl(${200}${mnCM.get(x, y) * 10}, 100%, 60%)`,
                        //opacity: 0.4,
                    //})
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/
            //Distance Transfor Visual
            /*for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = mnCM.get(x,y);
                    //if(weight == 0) continue;
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${mnCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/

            /*let baseCM = PathFinder.CostMatrix.deserialize(Memory.test8);
            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = baseCM.get(x,y);
                    if(weight == 0) continue;
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${baseCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }*/
            //new RoomVisual().circle(midPoint.x,midPoint.y,{fill:'red',radius:0.5});

            //console.log('CPU Used',Game.cpu.getUsed() - startCPU)
        }
        /*let mincutCM = PathFinder.CostMatrix.deserialize(Memory.saturatedTilesCM);
        for (let x = 0; x <= 49; x += 1) {
            for (let y = 0; y <= 49; y += 1) {
                let weight = mincutCM.get(x,y);
                if(weight == 0) continue;
                new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                    fill: `hsl(${200}${mincutCM.get(x, y) * 10}, 100%, 60%)`,
                    opacity: 0.4,
                })
                new RoomVisual().text(weight,x,y+0.25)
            }
        }*/

        if(Memory.testOn && Memory.testRoom && Memory.testRoomId){
            //console.log("YES")
            //Pull plan and split into array
            let plan = Memory.testRoom
            let testRoom = Memory.testRoomId
            for(let building in plan){
                if(Array.isArray(plan[building])){
                    plan[building].forEach(coordinate => {
                        new RoomVisual(testRoom).structure(coordinate.x,coordinate.y,building);
                    });
                }
            }
        }

        if(Memory.testMincutVisuals){
            let mincutCM;
            switch(Memory.mincutVisual){
                case 1:
                    mincutCM = PathFinder.CostMatrix.deserialize(Memory.mincutLevelCM);
                    break;
                case 2:
                    mincutCM = PathFinder.CostMatrix.deserialize(Memory.mincutCapacityCM);
                    break;
                case 3:
                    mincutCM = PathFinder.CostMatrix.deserialize(Memory.mincutFlowCM);
                    break;
                case 4:
                    mincutCM = PathFinder.CostMatrix.deserialize(Memory.saturatedTilesCM);
                    break;
                default:
                    mincutCM = PathFinder.CostMatrix.deserialize(Memory.mincutLevelCM);
                    break;
            }

            for (let x = 0; x <= 49; x += 1) {
                for (let y = 0; y <= 49; y += 1) {
                    let weight = mincutCM.get(x,y);
                    if(weight == 0) continue;
                    new RoomVisual().rect(x - 0.5, y - 0.5, 1, 1, {
                        fill: `hsl(${200}${mincutCM.get(x, y) * 10}, 100%, 60%)`,
                        opacity: 0.4,
                    })
                    new RoomVisual().text(weight,x,y+0.25)
                }
            }

            let memConnections = Memory.memConnections;
            memConnections.forEach(node=>{
                if(node.targets.length){
                    node.targets.forEach(target =>{
                        new RoomVisual().line(node.x,node.y,target[0],target[1])
                    })
                }
            })

            
            
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

        


        //Run as close to last as possible for accurate CPU count
        kingdomManager.run();
        //console.log("CPU Used:",Game.cpu.getUsed().toFixed(2),'/',Game.cpu.limit);

        Traveler.resolveMovement();

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


        if (Game.cpu.bucket == 10000) {
            Game.cpu.generatePixel()
            console.log("Shiny coin!")
        }
    });
}

//Global functions
//Spawn creep   - Grunt test
global.addCreep = addCreep;
//Add holding
global.addHolding = addHolding;
//Room testing visuals
global.testRoom = testRoom;
global.testVis = testVis;
//Distance
global.getDistance = getDistance;
//Clear spawn queue
global.clearQueue = clearQueue;
//Flip holding standby
global.standby = standby;




//Global functions
function testRoom(room,x,y){
    let mTest = roomPlanner.getPlan(x,y);
    Memory.testRoom = mTest;
    Memory.testRoomId = room;
};
function testVis(){
    Memory.testOn = !Memory.testOn;
}
function addCreep(room,name,body,memory,severity = 3){
    let newName = name+' '+helper.getName()+' of House '+room;
    Memory.kingdom.fiefs[room].spawnQueue[newName] = {sev:severity,body:body,memory:memory}
}
function addHolding(room,standby=false,homeRoom=null){
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
function standby(holding){
    //Flip standby flag
    Memory.kingdom.holdings[holding].standby = !Memory.kingdom.holdings[holding].standby
    //Clear spawn queue of homeroom to remove holding creeps
    clearQueue(Memory.kingdom.holdings[holding].homeRoom);
}
function clearQueue(room='all'){
    if(room == 'all'){
        Object.keys(Memory.kingdom.fiefs).forEach(fief =>{
            Memory.kingdom.fiefs[fief].spawnQueue = {};
        });
    }else{
        Memory.kingdom.fiefs[room].spawnQueue = {};
    }
}
function getDistance(pos1,pos2){
    let route = PathFinder.search(pos1,{pos:pos2,range:1});
    let dist = route.path.length;
    let incomp = route.incomplete;
    return [dist,incomp]
}
addHolding = profiler.registerFN(addHolding, 'addHolding');
