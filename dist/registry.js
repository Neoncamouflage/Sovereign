const helper = require('functions.helper');
const granary = require('granary');
const profiler = require('screeps-profiler');
//Spawn waits are how many times a priority spawn was skipped due to no energy. Can adjust behavior
//{roomName:{hauler:12,claimer:3}}
let spawnWaits = {};
const registry = {
    //Associates roles to names
    nameRef: {
        'hauler'   :'Porter',
        'harvester':'Serf',
        'upgrader' :'Scribe',
        'scout'    :'Pilgrim',
        'miner'    :'Yeoman',
        'claimer'  :'Baron',
        'builder'  :'Carpenter',
        'fortifier':'Mason',
        'diver'    :'Reaver',
        'bait'     :'Rogue',
        'sapper'   :'Sapper',
        'archer'   :'Archer',
        'settler':'Settler',
        'skirmisher'    :'Skirmisher',
        'pikeman'   :'Pikeman',
        'mineralHarvester': 'Gemcutter',
        'remoteHarvest' : 'Delver',
        'halberdier' : 'Halberdier',
        'crasher'    : 'Undertaker',
        'attacker'      : 'Knight',
        'healer'     : 'Squire',
        'guardsman' : 'Guardsman',
        'man-at-arms': 'Man-at-Arms',
        'declaimer'  : 'Duke',
        'guard' : 'Guardsman',
        'repair' : 'Paver',
        'marauder' : 'Marauder'
    },
    //Calculates which creeps, if any, should be spawned from each spawn queue
    calculateSpawns: function(room,fiefCreeps){
        //console.log("Calculating spawns. Tickmod:",Game.time % 3)
        let energyRemaining = room.energyAvailable;
        let fief = Memory.kingdom.fiefs[room.name]
        let spawnQueue = global.heap.registry[room.name] || []
        let spawns = fief.spawns.map(spawn => Game.getObjectById(spawn))
        let freeSpawns = [];
        
        for(each of spawns){
            if(!each.spawning) freeSpawns.push(each);
        }
        if(Memory.hardSpawns && Memory.hardSpawns[room.name]) spawnQueue.push(...Memory.hardSpawns[room.name])
        if(!spawnQueue.length) return;
        let qprint = '';
        for(let each of spawnQueue){
            qprint+=`${each.memory.job || each.memory.role} - ${each.sev}\n`
        }
        console.log(qprint)
        //Sort the queue's keys based on severity
        spawnQueue.sort((a, b) => b.sev - a.sev);
        
        //Loop through the keys and calculate if we can spawn
        for(let i = 0; i < spawnQueue.length; i++){
            let newCreep = spawnQueue[i];
            //Set up the spawnwait if we haven't yet
            if(!spawnWaits[room.name])spawnWaits[room.name] = {}
            if(!spawnWaits[room.name][newCreep.memory.role]) spawnWaits[room.name][newCreep.memory.role] = 0;
            //If there's a body requested, use it. Otherwise, calculate based on creep role.
            let body;
            let cost;
            //Set sev to memory if it isn't already, for our respawning function
            if(!newCreep.memory.sev)newCreep.memory.sev = newCreep.sev;

            if(newCreep.body){
                cost = 0;
                for(let part of newCreep.body){
                    cost += BODYPART_COST[part];
                }
            }
            else{
                [body,cost] = getBody(energyRemaining,newCreep.memory.role,room,(newCreep.memory.job || 'default'),fiefCreeps,newCreep)
                //If cost is -1, log the body error and continue
                if(cost == -1){
                    //console.log("Body error",JSON.stringify(body));
                    continue;
                }
                newCreep.body = body
            }

            //Warden activation means no civilian creep spawning
            if(heap.wardens && heap.wardens[room.name] && (['mineralHarvester'].includes(newCreep.memory.job) || ['miner','repair','claimer'].includes(newCreep.memory.role))){
                //console.log("Warden active in room trying to spawn civilian creep",room.name);
                continue;
            }
            
            
            //Check if spawn has energy
            //console.log(`Checking if ${room.energyAvailable} is enough for ${cost} to build ${newCreep.body}`)
            if(energyRemaining >= cost){
                let nextSpawn = freeSpawns.shift();
                //If spawning, continue
                if(!nextSpawn || nextSpawn.spawning){
                    //console.log("No spawns free");
                    continue
                }
                let newName;
                goodName = false;
                while(!goodName){
                    let houseName = Memory.kingdom.fiefs[room.name].house || 'Contested';
                    let jobTitle = this.nameRef[newCreep.memory.job] ? this.nameRef[newCreep.memory.job] : this.nameRef[newCreep.memory.role]
                    newName = jobTitle +' '+helper.getName()+' of '+room.name+', House '+houseName;
                    if(!Game.creeps[newName]) goodName = true;
                }
                //Assign a fief if one isn't provided or is invalid
                if(!newCreep.memory.fief || !Memory.kingdom.fiefs[newCreep.memory.fief]){
                    newCreep.memory.fief = room.name;
                }
                let spawnTry = this.spawnCreep(nextSpawn,newName,newCreep)

                //If we successfully spawned
                if (spawnTry == OK){
                    //If this was a respawn request from a creep, update them
                    if(newCreep.respawn) Game.getObjectById(newCreep.respawn).memory.respawn = true;
                    //If it was a hard spawn, remove it
                    if(newCreep.hardSpawn){
                        Memory.hardSpawns[room.name] = Memory.hardSpawns[room.name].filter(creepRequest => creepRequest !== newCreep);
                    }
                    energyRemaining -= cost;
                    //Reset the wait times
                    for(let val of Object.keys(spawnWaits[room.name])){
                        spawnWaits[room.name][val] = 0;
                    }
                    break;
                } 
                if(spawnTry != OK){
                    chronicle.log(`Failed spawn: Error ${spawnTry}. Creep:${JSON.stringify(newCreep)}`,'registry',1);
                    break;
                }
                
                //If no more free spawns, break
                
            }
            //If we're trying to spawn something too big for the room capacity, continue to the next one
            else if(room.energyCapacityAvailable < cost){
                chronicle.log(`${room.name} - Registry trying to spawn a creep too large for the room. ${JSON.stringify(newCreep)}`,'registry',1);
                continue;
            }
            else{
                //console.log("Room not yet at energy capacity to spawn. Cost:",cost,"Creep:",JSON.stringify(newCreep))
                //Focusing on priority. If we can't build the top priority creep yet, break and we wait
                //Increment how many times this creep has waited
                spawnWaits[room.name][newCreep.memory.role] += 1;
                break;
            }
            if(!freeSpawns.length) break;
        }
        global.heap.registry[room.name] = [];
    },
    //Spawns a creep
    spawnCreep: function(spawner,name,plan){
        //console.log("Spawn function")
        //console.log(`Spawner: ${spawner}, Name: ${name}, Plan: ${plan}`)
        if(spawner != null && spawner != undefined){
            let movePart = 0;
            let nonMove = 0;
            plan.body.forEach(part=>{
                if(part == MOVE){
                    movePart++;
                }
                else{
                    nonMove++;
                }
            });
            //Only mark them fat if they're road fat
            if(nonMove > movePart*2){
                plan.memory['fat'] = true;
            }
            try{
                let x = spawner.spawnCreep(plan.body,name,{memory:plan.memory});
                //console.log("SPAWN",name,x,plan.body)
                if(x == 0){
                    //console.log("SPAWN UPTIME TRACK")
                    //console.log(`RoomName ${spawner.room.name}, Uptime id ${spawner.id}, Body length ${plan.body.length}`)
                    //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
                    Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id].push({gameTime:Game.time,bodySize:plan.body.length});
                    //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
                }
                return x;
            }
            catch(e){
                //console.log(name+'spawn error '+e)
            }
            //Track spawn uptime by logging the spawn call

            //console.log(name+'\n'+)
            
        }
    },
    requestCreep: function(plan){
        let roomName = plan.memory.fief;
        if(roomName == undefined){
            chronicle.log(`Fief missing while trying to spawn $${JSON.stringify(plan)}`,'registry',1);
            return "Request failed"
        }
        global.heap.registry[roomName] = global.heap.registry[roomName] || [];
        global.heap.registry[roomName].push(plan);
        return "Request God"
    }
}
        
//#region Creep Body Switch
function getBody(energyRemaining,role,room,job='default',fiefCreeps,plan){
    let parts;
    let mult;
    let newBod;
    switch(role){
        case 'repair':
            return getRepair(energyRemaining,room)
        case 'scout':
            return getScout(energyRemaining,room,fiefCreeps);
        case 'harvester':
            switch(job){
                case 'remoteHarvest':
                case 'mineralHarvester':
                    return getMHarvester(energyRemaining,room,job)
                case 'energyHarvester':
                    return getEHarvester(energyRemaining,room,fiefCreeps)
            }
        case 'claimer':
            return getReserver(energyRemaining,room,fiefCreeps);  
        case 'miner':
            return getMiner(energyRemaining,plan)
        case 'hauler':
            return getHauler(energyRemaining,room,fiefCreeps);
        case 'upgrader':
            return getUpgrader(energyRemaining,room,fiefCreeps,job);
        case 'sapper':
            return getSapper(energyRemaining,room);
        case 'skHarvester':
            return getMHarvester(energyRemaining,room);
        case 'archer':
            return getArcher(energyRemaining,room,plan);
        case 'skirmisher':
            return getSkirmisher(energyRemaining,room,plan);
        case 'pikeman':
            return getPikeman(energyRemaining,room,plan);
        case 'settler':
            return getSettler(energyRemaining,room);
        case 'builder':
            return getBuilder(energyRemaining,room,fiefCreeps);
        case 'man-at-arms':
            return getManAtArms(room,plan);
    }
    //console.log("GETBODY FAIL FOR",role,room,job,fiefCreeps,JSON.stringify(plan))
    return [[],-1]
}
//#endregion
//#region Creep Body Functions


//Uniform blinky for quads
//Preferably should scale based based on data in the plan for how much heal we need to cover
function getManAtArms(room,plan){
    //Just this default for testing
    let parts = [RANGED_ATTACK,RANGED_ATTACK,MOVE,MOVE,MOVE,HEAL]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);

    return [parts,setCost];

    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    //Need to set up bodysize logic for the plan, for now default
    let maxBody = parts.length;
    let maxParts = Math.min(maxBody,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;
    let cap = 2;
    for(let i = 1; i < maxParts && newBody.length + parts.length <= 50 && i <= cap; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    
}

function getRepair(energyRemaining,room){
    let parts = [MOVE,CARRY,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let engAvail = room.energyCapacityAvailable;
    let mult = Math.floor(engAvail/partsCost)
    let arrCap = Math.floor(24/parts.length)
    let newBod = [].concat(...Array(Math.min(mult,arrCap)).fill(parts));
    let totalCost = 0;
    newBod.forEach(b => {
        totalCost += BODYPART_COST[b];
    });
    return [newBod,totalCost]
}

//Energy harvester - Serf
function getEHarvester(energyRemaining,room,fiefCreeps){
    let newBody = [MOVE,WORK];
    let partsCost = 0
    let maxWorkParts = 6;
    let [tickNet,avgNet] = granary.getIncome(room.name)
    //If we have 0 average and planned, and no harvesters, the energy is what we have now, otherwise max
    let energyAvailable = fiefCreeps['harvester'] ? room.energyCapacityAvailable : energyRemaining;
    //Default 1 move part
    partsCost += BODYPART_COST[MOVE]+BODYPART_COST[WORK];
    //Fill with work parts until we max out on energy or hit the cap
    while (newBody.length < maxWorkParts+1 && partsCost + BODYPART_COST[WORK] <= energyAvailable) {
        newBody.push(WORK);
        partsCost += BODYPART_COST[WORK];
    }
    //Add a carry if we can afford it
    if (newBody.length == maxWorkParts+1 && energyAvailable - partsCost >= BODYPART_COST[CARRY]) {
        newBody.push(CARRY);
        partsCost += BODYPART_COST[CARRY]
    }

    return [newBody,partsCost];
}

//Generalist - Settler
function getSettler(energyRemaining,room) {
    const parts = [MOVE, CARRY, MOVE, WORK];
    let partsCost = parts.reduce((sum, part) => sum + BODYPART_COST[part], 0);
    const engAvail = room.energyCapacityAvailable;

    let mult = Math.floor(engAvail / partsCost);
    let newBod = [];

    // Manually concatenate arrays to avoid `.flat()`
    for(let i = 0; i < mult; i++) {
        newBod = newBod.concat(parts);
        if (newBod.length >= 50) {
            newBod = newBod.slice(0, 50);
            break;
        }
    }

    const totalPartsCost = newBod.reduce((sum, part) => sum + BODYPART_COST[part], 0);

    //console.log("SETTLERBODY", newBod);

    return [newBod, totalPartsCost];
}


//Miner - Yeoman
function getMiner(energyRemaining,plan){
    let holding = plan.memory.holding;
    /*
    Distance Ref
    30:2,
    60:3,
    80:4,
    110:5,
    130:6
    */
    let partsCost = 0;

    let homeFief = Game.rooms[Memory.kingdom.holdings[holding].homeFief];
    let energyAvailable = homeFief.energyCapacityAvailable;
    let newBody;
    //Body choice depends on capacity available
    if(energyAvailable >= 800){
        newBody = [MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,CARRY];
    }
    else if(energyAvailable >= 500){
        newBody = [MOVE,MOVE,MOVE,CARRY,WORK,WORK,WORK];
    }
    else{
        newBody = [MOVE,MOVE,WORK,WORK];
    }
    newBody.forEach(part =>{
        partsCost += BODYPART_COST[part]
    })

    return [newBody,partsCost];
}

//Military Creeps
function getSapper(energyRemaining,room){
    let parts = [MOVE,WORK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable

    let maxParts = Math.floor(energyAvailable / setCost);
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for(let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getArcher(energyRemaining,room,plan){
    let parts = [MOVE,RANGED_ATTACK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    let maxParts = Math.min(plan.bodySize,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for(let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getPikeman(energyRemaining,room,plan){
    let parts = [MOVE,ATTACK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    let maxParts = Math.min(20,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for(let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getSkirmisher(energyRemaining,room,plan){
    let parts = room.controller.level >=4 ?[MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL] : [MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,HEAL]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    //Need to set up bodysize logic for the plan, for now default
    let maxBody = parts.length;
    let maxParts = Math.min(maxBody,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;
    let cap = 2;
    for(let i = 1; i < maxParts && newBody.length + parts.length <= 50 && i <= cap; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}

//General hauler - Porter
function getHauler(energyRemaining,room,fiefCreeps){
    //If at least 3 of the holding roads are done, or less if there's not that many remotes, 2c1m is approved
    let roadsDone = Object.values(Memory.kingdom.fiefs[room.name].roadsDone||{}).reduce((sum,each)=>sum+each,0) >= Math.min(Object.values(Memory.kingdom.fiefs[room.name].roadsDone||{}).length,3);
    let parts = roadsDone && room.controller.level >=4 ? [MOVE, CARRY, CARRY] : [MOVE,CARRY];
    let partsCap = (()=>{ //Caps total parts
        if(global.cpuAverage/Game.cpu.limit > .90) return 36;            //Large creeps if over 90% CPU use
        //if(parts.length == 2 || room.controller.level == 8) return 20;  //Need to remember why I added this
        if(!room.storage){
            //if(Object.keys(Memory.kingdom.fiefs).length == 1) return 6;
            //else 
            return 8;
        }
        return 18;
    })()
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0); //Cost of every part in the set
    //Caps energy spend
    let maxCap = global.cpuAverage > 90 || room.controller.level < 4 ? room.energyCapacityAvailable : Math.ceil(room.energyCapacityAvailable/2)
    //Spawn immediately if we have less than 3 haulers or have waited 3 rounds (9 ticks) to spawn
    let energyAvailable = (fiefCreeps['hauler'] && fiefCreeps['hauler'].length >= 3 && (!spawnWaits[room.name]['hauler'] || spawnWaits[room.name]['hauler'] < 20)) ? maxCap : energyRemaining;
    
    let cap = Math.min(room.controller.level > 3 ? 1800 : 600, energyAvailable);
    let maxParts = Math.min(Math.floor(cap / setCost),Math.floor(partsCap/parts.length));
    let newBody = [];
    let totalCost = 0;
    newBody.push(...parts);
    totalCost += setCost;

    for(let i = 1; i < maxParts; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}

//Starter upgrader - Scribe
function getUpgrader(energyRemaining,room,fiefCreeps,job){
    let parts = [MOVE,CARRY,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let isStarter = job == 'starterUpgrader';
    let engAvail = (!fiefCreeps.upgrader && isStarter) ? energyRemaining : room.energyCapacityAvailable;
    let mult = Math.floor(engAvail/partsCost)
    let arrCap = room.controller.level > 3 ? 4 : 2;
    //console.log(mult)
    let newBod = [].concat(...Array(Math.min(mult,arrCap)).fill(parts));
    //If mult is 2 or more, stuff however many more work parts we can
    //Get the total cost of the body
    let totalCost = 0;
    newBod.forEach(b => {
        totalCost += BODYPART_COST[b];
    });
    if(mult >= 2){
        //Get how many work parts we can fit in the difference
        let gapParts = Math.floor((engAvail-totalCost)/100);
        newBod = newBod.concat(Array(Math.min(gapParts,50-newBod.length)).fill(WORK));
        totalCost += gapParts*BODYPART_COST[WORK];
    }
    return [newBod,totalCost]
}

function getScout(energyRemaining,room,fiefCreeps){
    //Make sure we have harvesters and haulers before we do any scouts
    if(!fiefCreeps.harvester || !fiefCreeps.hauler) return ['REGISTRY_BABY_FIEF',-1];
    
    return [[MOVE],50]
}
function getMHarvester(energyRemaining,room,job = 'default'){
    let engAvail = room.energyCapacityAvailable
    parts = [MOVE,WORK,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    //Add work/move cost
    
    mult = Math.floor(engAvail/partsCost)
    //Max number of arrays so we don't pass 50 parts
    let arrMax = Math.floor(50/parts.length)
    //Fill new body with either the multiple we can afford or the max, whichever is smaller
    newBod = [].concat(...Array(Math.min(mult,arrMax)).fill(parts));
    partsCost = newBod.reduce((totalCost, part) => totalCost + BODYPART_COST[part], 0);
    //console.log(newBod)
    if(job == 'remoteHarvest') {
        for(let i = 0; i < newBod.length; i++) {
            if (newBod[i] == WORK) {
                newBod[i] = CARRY;
                partsCost -= BODYPART_COST[WORK] - BODYPART_COST[CARRY];
                break;
            }
        }
    }
    
    return [newBod,partsCost];
}

function getReserver(energyRemaining,room,fiefCreeps){
    let parts = [MOVE,CLAIM];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let engAvail = room.energyCapacityAvailable;
    let mult = Math.floor(engAvail/partsCost)
    let arrCap = 6//Math.floor(MAX_CREEP_SIZE/parts.length)
    let newBod = [].concat(...Array(Math.min(mult,arrCap)).fill(parts));
    //Get the total cost of the body
    let totalCost = 0;
    newBod.forEach(b => {
        totalCost += BODYPART_COST[b];
    });
    //console.log("RESBOD",newBod)
    return [newBod,totalCost]
    //return[[],-1]
}

//Builders - Fortifier/Mason
function getBuilder(energyRemaining,room,fiefCreeps){
    let parts = [MOVE,CARRY,CARRY,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let engAvail = room.energyCapacityAvailable;
    let mult = Math.floor(engAvail/partsCost)
    let arrCap = Math.floor(MAX_CREEP_SIZE/parts.length)
    let newBod = [].concat(...Array(Math.min(mult,arrCap)).fill(parts));
    let totalCost = 0;
    newBod.forEach(b => {
        totalCost += BODYPART_COST[b];
    });
    return [newBod,totalCost]
}
//#endregion


module.exports = registry;
profiler.registerObject(registry, 'registry');
getBody = profiler.registerFN(getBody, 'getBody');