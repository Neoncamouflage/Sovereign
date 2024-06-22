const helper = require('functions.helper');
const roomPlanner = require('roomPlanner');
const missionManager = require('missionManager')
const profiler = require('screeps-profiler');
var holdingManager = {
    /** @param {Room} room **/
    run: function(room) {
        try{
            var holding = Memory.kingdom.holdings[room]
            var homeRoom = holding.homeRoom
            var remote = Game.rooms[room];
            var builder = holding.builder
            var homeLevel = Game.rooms[homeRoom].controller.level;
            var homeEnergy = Game.rooms[homeRoom].energyCapacityAvailable;
            var homeStorage = Game.rooms[homeRoom].storage;
        }
        catch(error){
            console.log(room +'   '+error)
        }
        //------Initial Checks------//
        //If room closed, standby
        //Make this check better at some point by suiciding the creeps as well
        if(Game.map.getRoomStatus(room).status == 'closed'){
            holding.standby = true;
        }
        //If homeroom doesn't exist, the remote doesn't need to exist
        if(!Game.rooms[homeRoom]){
            console.log("Removing remote",room,'for dead fief',homeRoom);
            delete Memory.kingdom.holdings[room]
            //If closed by ice wall. SEASONAL SEASONAL SEASONAL
            //FIX
            if(Game.map.getRoomStatus(homeRoom).status == 'closed'){
                console.log("CLOSED")
                delete Memory.kingdom.holdings[room];
                return;
                //Kill everything
                let oldCreeps = [holding.builder,holding.claimer,holding.remoteDefender,...holding.remoteGens];
                Object.keys(holding.sources).forEach(source => {
                    oldCreeps.push(holding.sources[source].miner,holding.sources[source].trucker,...holding.sources[source].truckers)
                });
                oldCreeps.forEach(creep => {
                    if(Game.creeps[creep])Game.creeps[creep].suicide();
                })
                delete Memory.kingdom.holdings[room];
            }






            //SEASONAL SEASONAL SEASONAL
            return;
        }
        //Set mining location cache
        if(!holding.canSites){
            holding.canSites = [];
        }
        //Set energy limits for steps
        let canBuildLimit = 10000;
        let roadBuildLimit = 7000;
        //Do we have source data for the room
        if(!holding.sources){
            //Do we have vision
            if(remote){
                //If so, record the sources
                if(!holding.sources){
                    holding.sources = {}
                }
                let holdSources = remote.find(FIND_SOURCES);
                holdSources.forEach(source => {
                    holding.sources[source.id] = {id:source.id}
                })
            }

            //Else, do we have a scouting mission already
            else if(Memory.kingdom.missions.scout[room]){
                //If so, return
                return;
            }
            //Else create one, then return
            else{
                //Set up a mission to scout this holding, from the homeroom
                Memory.kingdom.missions.scout[room] = {homeRoom:homeRoom};
                return;
            }

            
        }

        

        //Do we have remote CM and road plan yet - To avoid mass calculation of all existing remotes, triggering this one by one
        if(!holding.costMatrix || !holding.remoteRoad){
            //Do we have vision
            if(remote){
                //Do we need a new CM
                let newCM;
                if(!holding.costMatrix){
                    newCM = new PathFinder.CostMatrix;
                }else{
                    //If not, assign ours
                    newCM = PathFinder.CostMatrix.deserialize(holding.costMatrix);
                }
                let storePos;
                if(homeStorage){
                    storePos = homeStorage.pos;
                }else{
                    storePos = roomPlanner.getStoragePos(Game.rooms[homeRoom]);
                }

                let remoteRoute;
                //Generate a route from the homeroom storage location if needed
                if(holding.remoteRoad){
                    remoteRoute = holding.remoteRoad;
                }else{
                    remoteRoute = helper.routeRemoteRoad(room,storePos);
                    //Assign route to holding
                    holding.remoteRoad = remoteRoute;
                }
                
                //Update holding CM
                //Keep track of other room CMs we're updating
                let otherCM;
                let otherRoom;
                let otherRoomType;
                remoteRoute.forEach(spot =>{
                    if(spot.roomName == room){
                        newCM.set(spot.x,spot.y,1)
                    }
                    //If it isn't this holding, see if we can update another room's CM
                    //See if we've already got it
                    else if(otherRoom && otherCM && spot.roomName == otherRoom){
                        //Update the existing other room's CM if not already set
                        if(otherCM.get(spot.x,spot.y) == 0){
                            otherCM.set(spot.x,spot.y,1)
                        }
                    }
                    //If we don't already have it, or it's a different room, get it
                    //Check holdings
                    else if(Memory.kingdom.holdings[spot.roomName]){
                        //First, submit the other room's CM if need be
                        if(otherRoom){
                            Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                        }
                        //Set our tracking for the other room
                        otherRoom = spot.roomName
                        otherRoomType = 'holdings'
                        //Get the other CM
                        otherCM = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[spot.roomName].costMatrix);
                        //Set the cost we found
                        if(otherCM.get(spot.x,spot.y) == 0){
                            otherCM.set(spot.x,spot.y,1)
                        }

                    }
                    //Same for fiefs
                    else if(Memory.kingdom.fiefs[spot.roomName]){
                        if(otherRoom){
                            Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                        }
                        otherRoom = spot.roomName
                        otherRoomType = 'fiefs'
                        otherCM = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[spot.roomName].costMatrix);
                        if(otherCM.get(spot.x,spot.y) == 0){
                            otherCM.set(spot.x,spot.y,1)
                        }
                    }
                    
                })
                //Submit CM for our holding and for the other room if we have one
                holding.costMatrix = newCM.serialize();
                if(otherCM){
                    Memory.kingdom[otherRoomType][otherRoom].costMatrix =  otherCM.serialize();
                }
            }
        }
        //Confirm remote is on standby, skip operation if not.
        if(holding.standby){
            return;
        }

        //If the path to each source isn't calculated yet, or if we need to update from a spawn path, get it
        //For each source

        ////THIS IS WHAT WORKED {pos:Game.getObjectById(source).pos,range:1} as target
        //Range in opts object does nothing
        Object.keys(holding.sources).forEach(source =>{
            //If there is no route, or it's only a controller route, calculate
            //Route if storage
            if(!holding.sources[source].route && holding.costMatrix){
                //
                let newPath;
                let storePos;
                if(homeStorage){
                    storePos = homeStorage.pos;
                }else{
                    storePos = roomPlanner.getStoragePos(Game.rooms[homeRoom]);
                }
                if(Game.getObjectById(source)){

                    newPath = PathFinder.search(storePos,{pos:Game.getObjectById(source).pos,range:1},{
                        plainCost:10,
                        swampCost:12,
                        maxOps:14000,
                        ignoreCreeps:true,
                        roomCallback: function(roomName){
                            let room = Game.rooms[roomName];
                            let costs;
                            if(Memory.kingdom.fiefs[roomName] && Memory.kingdom.fiefs[roomName].costMatrix){
                                costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.fiefs[roomName].costMatrix);
                            }
                            //Check holdings
                            else if(Memory.kingdom.holdings[roomName] && Memory.kingdom.holdings[roomName].costMatrix){
                                costs = PathFinder.CostMatrix.deserialize(Memory.kingdom.holdings[roomName].costMatrix);
                            }else{
                                costs = new PathFinder.CostMatrix
                            }
                            if(room){
                                room.find(FIND_STRUCTURES).forEach(function(struct) {
                                    if (struct.structureType === STRUCTURE_ROAD) {
                                      // Favor roads over plain tiles
                                      costs.set(struct.pos.x, struct.pos.y, 1);
                                    }
                                    
                                  });
                            };                            
                            return costs;
                        },
                    });

                    let endSite = newPath.path[newPath.path.length-1];
                    //delete holding.controllerRoute;
                    delete holding.sources[source].controllerRoute;
                    //Assign path to source route
                    holding.sources[source].route = newPath.path;
                    //Add the can site to list
                    holding.canSites.push([endSite.x,endSite.y]);

                };


                
            }
            //Route if no storage, mark flag in memory so this can be updated later
            /*else if(!holding.sources[source].route){
                //Commented out for now. Bring back when we want pre-storage roads
                //console.log("Newroute")
                let newPath;
                let hController = Game.rooms[homeRoom].controller;
                if(hController && Game.getObjectById(source)){
                    newPath = PathFinder.search(hController.pos,{pos:Game.getObjectById(source).pos,range:1},{
                        maxOps:6000,
                        ignoreCreeps:true,
                        roomCallback: function(roomName){
                            let room = Game.rooms[roomName];
                            if(!room) return;
                            let costs = new PathFinder.CostMatrix;

                            if(Memory.kingdom.holdings[roomName] && Memory.kingdom.holdings[roomName].canSites){
                                Memory.kingdom.holdings[roomName].canSites.forEach(can => {
                                    costs.set(can[0],can[1],0xff);
                                });
                            }


                            return costs;
                        },
                    });
                    let endSite = newPath.path[newPath.path.length-1];
                    //console.log(source)
                    //if(Game.getObjectById(source).pos.getRangeTo())
                    holding.sources[source].route = newPath.path;
                    holding.sources[source].controllerRoute = true;
                    holding.canSites.push([endSite.x,endSite.y]);
                }
            }*/
            else{
                //Else, periodically make sure we have roads if home level and energy can support it
                if(Game.time % 80 && !holding.sources[source].standby && Game.rooms[room] && (homeStorage && homeLevel >= 4 && homeStorage.store[RESOURCE_ENERGY] >=roadBuildLimit)){
                    holding.sources[source].route.forEach(spot => {
                        //Build site unless it's the last one, don't need a road under the can
                        if(Game.rooms[spot.roomName] && spot != holding.sources[source].route[holding.sources[source].route.length-1]) {
                            let spotStruct = Game.rooms[spot.roomName].lookForAt(LOOK_STRUCTURES,spot.x,spot.y);
                            let spotSite = Game.rooms[spot.roomName].lookForAt(LOOK_CONSTRUCTION_SITES,spot.x,spot.y);
                            if((!spotStruct.length && !spotSite.length) && (spot.x > 0 && spot.x < 49 && spot.y > 0 && spot.y < 49)){
                                let x = Game.rooms[spot.roomName].createConstructionSite(spot.x,spot.y,STRUCTURE_ROAD);
                                console.log("SITE5",spot.roomName)
                            }
                        }
                    })
                }
            }
        })
        
        
        
        //------Room Operation------//
        
        //If we have vision, do things
        if(remote){
            let roomBaddies = remote.find(FIND_HOSTILE_CREEPS);
            let roomCores = remote.find(FIND_HOSTILE_STRUCTURES);
            let roomSites = remote.find(FIND_MY_CONSTRUCTION_SITES);
            //console.log(roomBaddies.length)
            //Set alarm false before re-running check
            holding.alarm = false;
            //Check for enemies and raise alarm
            if(roomBaddies.some(creep => !helper.isScout(creep) && !Memory.diplomacy.allies.includes(creep.owner.username))){
                //console.log("YES")
                //Check each hostile to make sure they aren't all allies
                for(let each of roomBaddies){
                        //Mark invader if it is
                        if(each.owner.username == "Invader"){
                            holding.alarm = true;
                            holding.alarmType = 'Invader';
                        }
                        //See if it's just a scout
                        else if(!helper.isScout(each)){
                            holding.alarm = true;
                            holding.alarmType = 'Invader';
                        }

                        //Set defense mission if hostile creeps are detected and they're not scouts
                        if(!Memory.kingdom.missions.defend[room]){
                            missionManager.createMission('defend',room,{invader:true,hostileCreeps:roomBaddies,core:roomCores.length >0})
                        }
                    }
            }
            if(roomCores.length && !holding.alarm){
                holding.alarm = true;
                holding.alarmType = 'Core';
            }
            //Check reservation status and request claimer if needed, if homeroom can support it
            if(!remote.controller || !remote.controller.reservation || remote.controller.reservation.ticksToEnd < 2000 || remote.controller.reservation.username == 'Invader'){
                //Check if a claimer is already assigned and alive, or queued. Add to homeroom spawn queue if not
                let claimBody = [MOVE,CLAIM];
                let claimCost = 650;
                let mult = Math.floor(homeEnergy/claimCost);
                let newBod = [].concat(...Array(Math.min(mult, 5)).fill(claimBody));
                if(homeEnergy >= 1300 && (!holding.claimer || (!Game.creeps[holding.claimer] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.claimer]))){
                    let newName = 'Baron '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:newBod,
                        memory:{role:'claimer',job:'reserver',homeRoom:homeRoom,fief:homeRoom,holding:room,targetRoom:room,controllerPos:{x:remote.controller.pos.x,y:remote.controller.pos.y},preflight:false}}
                    holding.claimer = newName;                    
                }
            }


            let cSiteWork = 0;
            remote.find(FIND_MY_CONSTRUCTION_SITES).forEach(site => {
                cSiteWork += site.progressTotal;
            });
            //console.log(cSiteWork,' Total Work in ',room)
            //If there are construction sites, submit builder request to homeroom spawn if one isn't around already
            if((!holding.standby && !builder || (!Game.creeps[builder] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[builder])) && roomSites.length && homeEnergy >= 650){
                let newName = 'Engineer '+helper.getName()+' of House '+room;
                Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                    sev:2,body:[MOVE,CARRY,WORK,MOVE,CARRY,WORK,MOVE,WORK,WORK],
                    memory:{role:'builder',job:'remoteBuilder',homeRoom:room,holding:room,fief:homeRoom,preflight:false}}
                holding.builder = newName;   
            }
        }
        
        
        //All other operations that don't require vision
        //If alarm and no defender alive/queued
        //Expand this later for more robust defense options
        if(homeEnergy >= 1300 && holding.alarm && (!holding.remoteDefender || (!Game.creeps[holding.remoteDefender] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.remoteDefender]))){
            let defenderBody;
            let dJob = holding.alarmType
            let dName;
            switch(holding.alarmType){
                case 'Invader':
                    defenderBody = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL];
                    dName = 'Archer '
                    break;
                case 'Core':
                    defenderBody = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                    dName = 'Pikeman'
                    break;
            }
            let newName = dName+helper.getName()+' of House '+room;
            Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                sev:8,body:defenderBody,
                memory:{role:'remoteDefender',job:dJob,targetRoom:room,holding:room,fief:homeRoom,preflight:false}}
            holding.remoteDefender = newName;  
        }else if(holding.alarm && (!holding.remoteDefender || (!Game.creeps[holding.remoteDefender] && !Memory.kingdom.fiefs[homeRoom].spawnQueue[holding.remoteDefender]))){
            //holding.standby = true;
        }
        
        //Loop through sources
        for(let source in holding.sources){
            let each = holding.sources[source];
            
            //Start source info for room status
            //roomStatus += ('\nSource '+each.id+':');
            
            //If source is on standby or no route yet, skip
            if(each.standby || !each.route){
                //console.log("STANDBY SOURCE");
                break;
            }
            //Can sites
            if(!each.x || !each.y){

                each.x = each.route[each.route.length-1].x;
                each.y = each.route[each.route.length-1].y;
            }
            
            //Check if can ID doesn't exist or if we have vision and can confirm the can isn't active. If either, request builder and set up a CSite for a new can.
            //No cans until home is able to support
            if(homeLevel >= 4 && (!each.can || (remote && !Game.getObjectById(each.can)))){
                let justBuilt = false;
                //Make sure we haven't just built a can
                if(remote){
                    let spot = remote.lookForAt(LOOK_STRUCTURES,each.x,each.y);
                    //console.log(spot)
                    //If we found stuff
                    if(spot.length){
                        //Check each thing on the tile and see if it's a container
                        for(let every of spot){
                            if(every.structureType == STRUCTURE_CONTAINER){
                                //If we have, assign its ID
                                each.can = every.id
                                justBuilt = true;
                                //If we have a trucker, tell them to use the can
                                if(Game.creeps[each.trucker]){
                                    Game.creeps[each.trucker].memory.canID = every.id
                                }
                            }
                        }
                        
                    }
                }
                if(!justBuilt && homeStorage && homeStorage.store[RESOURCE_ENERGY] > canBuildLimit){
                    //If we haven't just built a can, add can request to status feed if homeroom can support.
                    //roomStatus += ('\nMissing Can');

                    //If we have vision, and if no CSite for the can exists, create one

                    if(remote && !remote.lookForAt(LOOK_CONSTRUCTION_SITES,each.x,each.y).length){
                        remote.createConstructionSite(each.x,each.y,STRUCTURE_CONTAINER);
                        console.log("SITE6")
                    }
                }
            }
            //console.log(!Game.creeps[each.miner],'test')
            //Check to see if miner is assigned/alive/queued. If not, request from homeroom.
            let minerBody = [MOVE,MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK]
            //If storage, slightly bigger body to save on intents and can repair
            if(homeEnergy >= 1000 ) minerBody = [MOVE,MOVE,MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK]
            if(!holding.alarm && homeEnergy >= 1300 && (!each.miner || ((!Game.creeps[each.miner] || (each.route && Game.creeps[each.miner].ticksToLive < 30 + each.route.length)) && !Memory.kingdom.fiefs[homeRoom].spawnQueue[each.miner]))){
                let newName = 'Yeoman '+helper.getName()+' of House '+room;
                Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                    sev:4,body:minerBody,
                    memory:{role:'miner',homeRoom:room,fief:homeRoom,holding:room,harvestSpot:{x:each.x,y:each.y,id:each.id,can:each.can},routeLength:each.route.length,preflight:false}}
                each.miner = newName;
                //console.log('miner')
            }
            //Check to see if trucker is assigned/alive. If not, request from homeroom. Only if there's an active can and home storage
            //Trucker only happens if theres a can so no energy check - Bad logic means we do need a check for now
            if(homeStorage && homeEnergy >= 1300 && !holding.alarm){
                
                //Array of truckers
                //delete each.truckers;
                //return
                if(!each.truckers) each.truckers = [];
                let trucks = [];
                each.truckers.forEach(t => {
                    trucks.push(t);
                });
                //(!each.trucker || ((!Game.creeps[each.trucker] || Game.creeps[each.trucker].ticksToLive < 800) && !Memory.kingdom.fiefs[homeRoom].spawnQueue[each.trucker]))
                //Short fix for now
                if(!each.route) return;
                //Calculate the body needed based on path distance plus a buffer
                let parts = [MOVE,CARRY,CARRY];
                let partsCost = 150;
                //Times 2 for round trip, times 10 for energy per tick, 2 for transferring, plus 10 for buffer
                let carryNeeded = ((each.route.length*2)*10)+2+10;
                //How many arrays we need
                let mult = Math.ceil(carryNeeded/100);
                //Max arrays the room can support, subtracting 150 from energy for work/move array
                let maxMult = Math.floor((homeEnergy-150)/partsCost)

                //Fix maxMult if it's too large, can support 16 arrays of current parts
                if(maxMult > 16){
                    maxMult = 16
                }


                //Total trucks we need for this route
                let totalTrucks = Math.ceil(mult/maxMult);
                //Arrays per truck
                let totalMult = mult/Math.ceil(mult/maxMult);
                /*if(room == 'W44S12' && source == '65a70dc534fa299b8cef8081'){
                    console.log('Total carry needed: ',carryNeeded)
                    console.log('Total arrays needed: ',mult)
                    console.log('Total trucks we need for the route: ',totalTrucks,'\nWith ',totalMult,' arrays each')
                    console.log('Total cost per truck: ',(totalMult*150)+150)

                }*/
                
                //Live truck counter
                let liveTrucks = [];
                //See how many trucks we have right now
                //console.log(trucks)
                trucks.forEach(truck => {
                    if(Game.creeps[truck] || Memory.kingdom.fiefs[homeRoom].spawnQueue[truck]){
                        liveTrucks.push(truck);
                    }
                    //console.log(liveTrucks)
                })
                //console.log("REMOTE ",room,' needs ',totalTrucks,'total trucks. ',liveTrucks.length,' live trucks. ');
                //console.log(liveTrucks.length < totalTrucks)
                //console.log(liveTrucks,' ',room)
                if(liveTrucks.length < totalTrucks){
                    //console.log('mult: ',mult,' totalTrucks: ',totalTrucks)
                    let truckerBody = [].concat(...Array(Math.ceil(totalMult)).fill(parts));
                    truckerBody.push(WORK,MOVE);
                    let newName = 'Caravaner '+helper.getName()+' of House '+room;
                    //console.log(truckerBody);
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:truckerBody,
                        memory:{role:'trucker',homeRoom:room,fief:homeRoom,holding:room,pickupSpot:[each.x,each.y],sourceID:each.id,canID:each.can,homeRoom:homeRoom,targetRoom:room,routeLength:each.route.length,preflight:false}}
                    liveTrucks.push(newName);
                }
                each.truckers = liveTrucks;

                /*liveTrucks.forEach(k => {
                    each.truckers.push(k)
                })*/
                //console.log(each.truckers)
                //console.log(liveTrucks,' LIVE')
                

            }
            //Check if no home storage to send remote generalists instead
            /*else if(homeEnergy >= 700 && homeEnergy < 1300){
                
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                if(genCount < totalNeed){
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,WORK,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }
            else if(!homeStorage && homeEnergy >= 550){
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                
                if(genCount < totalNeed){
                    console.log(room)
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }else if(!homeStorage && homeEnergy < 550){
                //Check and see if we need more generalists
                let genCount = 0;
                //Complete guess, find a better way to do this
                let totalNeed = 8;
                //Array to hold the good ones
                let goodRemotes = [];
                //Set up the remote gen array if needed
                if(!holding.remoteGens) holding.remoteGens = [];
                //Loop through and see if they're alive, if so, increment genCount
                holding.remoteGens.forEach(gen =>{
                    if(Game.creeps[gen] || Memory.kingdom.fiefs[homeRoom].spawnQueue[gen]){
                        genCount +=1;
                        goodRemotes.push(gen);
                    }
                });
                //If we're short, spawn
                
                if(genCount < totalNeed){
                    console.log(room)
                    let newName = 'Forager '+helper.getName()+' of House '+room;
                    Memory.kingdom.fiefs[homeRoom].spawnQueue[newName] = {
                        sev:3,body:[MOVE,MOVE,CARRY,WORK],
                        memory:{role:'generalist',homeRoom:homeRoom,targetRoom:room,pickupSpot:[each.x,each.y],job:'remote',preflight:false}}
                    goodRemotes.push(newName);
                }

                holding.remoteGens = goodRemotes;

                
            }*/
            
        }
        
        
        if(!holding.alarm){
            holding.standby = false;
        }

        //Visualize paths
        /*Object.keys(holding.sources).forEach(source => {
            holding.sources[source].route.forEach(spot => {
                new RoomVisual(spot.roomName).circle(spot);
            })
        })*/

        //Do something with room status, for now console
        //console.log(roomStatus)
    }
};

module.exports = holdingManager;
profiler.registerObject(holdingManager, 'holdingManager');