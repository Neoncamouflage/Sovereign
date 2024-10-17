const helper = require('functions.helper');
const granary = require('granary');
const profiler = require('screeps-profiler');
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
        'generalist':'Settler',
        'skirmisher'    :'Skirmisher',
        'pikeman'   :'Pikeman',
        'mineralHarvester': 'Gemcutter',
        'remoteHarvest' : 'Delver',
        'halberdier' : 'Halberdier',
        'crasher'    : 'Undertaker'
    },
    //Calculates which creeps, if any, should be spawned from each spawn queue
    calculateSpawns: function(room,fiefCreeps){
        //console.log("Calculating spawns. Tickmod:",Game.time % 3)
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
            qprint+=`${each.memory.role} - ${each.sev}\n`
        }
        console.log(qprint)
        //Sort the queue's keys based on severity
        spawnQueue.sort((a, b) => b.sev - a.sev);
        
        //Loop through the keys and calculate if we can spawn
        for(let i = 0; i < spawnQueue.length; i++){
            let newCreep = spawnQueue[i];
            //If there's a body requested, use it. Otherwise, calculate based on creep role.
            let body;
            let cost;
            
            if(newCreep.body){
                cost = 0;
                for(let part of newCreep.body){
                    cost += BODYPART_COST[part];
                }
            }
            else{
                [body,cost] = getBody(newCreep.memory.role,room,(newCreep.memory.job || 'default'),fiefCreeps,newCreep)
                //If cost is -1, log the body error and continue
                if(cost == -1){
                    console.log(body);
                    continue;
                }
                newCreep.body = body
            }
            
            
            
            //Check if spawn has energy
            console.log(`Checking if ${room.energyAvailable} is enough for ${cost} to build ${newCreep.body}`)
            if(room.energyAvailable >= cost){
                let nextSpawn = freeSpawns.shift();
                //If spawning, continue
                if(!nextSpawn || nextSpawn.spawning) continue;
                let newName = this.nameRef[newCreep.memory.job] ? this.nameRef[newCreep.memory.job]+' '+helper.getName()+' of House '+room.name : this.nameRef[newCreep.memory.role]+' '+helper.getName()+' of House '+room.name;
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
                        let index = Memory.hardSpawns[room.name].indexOf(newCreep);
                        Memory.hardSpawns[room.name].splice(index,1);
                    }
                } 
                if(spawnTry != OK){
                    console.log("Bad spawn:",spawnTry)
                }
                //If no mre free spawns, break
            }
            else{
                //Focusing on priority. If we can't build the top priority creep yet, break and we wait
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
            if(nonMove*2 > movePart){
                plan.memory['fat'] = true;
            }
            try{
                let x = spawner.spawnCreep(plan.body,name,{memory:plan.memory});
                console.log("SPAWN",name,x,plan.body)
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
                console.log(name+'spawn error '+e)
            }
            //Track spawn uptime by logging the spawn call

            //console.log(name+'\n'+)
            console.log("SPAWN",name,x)
        }
    },
    requestCreep: function(plan){
        let roomName = plan.memory.fief;
        if(roomName == undefined){
            console.log("Fief missing while trying to spawn",plan.memory.role);
            return
        }
        global.heap.registry[roomName] = global.heap.registry[roomName] || [];
        global.heap.registry[roomName].push(plan);
    }
}
        

module.exports = registry;
profiler.registerObject(registry, 'registry');
//#region Creep Body Switch
function getBody(role,room,job='default',fiefCreeps,plan){
    let parts;
    let mult;
    let newBod;
    switch(role){
        case 'scout':
            return getScout(room,fiefCreeps);
        case 'harvester':
            switch(job){
                case 'remoteHarvest':
                case 'mineralHarvester':
                    return getMHarvester(room,job)
                case 'energyHarvester':
                    return getEHarvester(room,fiefCreeps)
            }
            break;
        case 'claimer':
            return getReserver(room,fiefCreeps);  
            break;
        case 'miner':
            return getMiner(plan)
            break;
        case 'hauler':
            return getHauler(room,fiefCreeps);
            break;
        case 'upgrader':
            return getUpgrader(room,fiefCreeps,job);
            break;
        case 'sapper':
            return getSapper(room);
            break;
        case 'skHarvester':
            return getMHarvester(room);
            break;
        case 'archer':
            return getArcher(room,plan);
            break;
        case 'skirmisher':
            return getSkirmisher(room,plan);
            break;
        case 'pikeman':
            return getPikeman(room,plan);
            break;
        case 'generalist':
            return getGeneralist(room);
        case 'builder':
            switch(job){
                case 'fortifier':
                    return getFortifier(room,fiefCreeps);
                default:
                    return getFortifier(room,fiefCreeps);
            }
            break;
    }
    console.log("GETBODY FAIL FOR",role,room,job,fiefCreeps,JSON.stringify(plan))
    return [[],-1]
}
//#endregion
//#region Creep Body Functions


//Energy harvester - Serf
function getEHarvester(room,fiefCreeps){
    let newBody = [MOVE,WORK];
    let partsCost = 0
    let maxWorkParts = 6;
    let [tickNet,avgNet] = granary.getIncome(room.name)
    //If we have 0 average and planned, and no harvesters, the energy is what we have now, otherwise max
    let energyAvailable = fiefCreeps['harvester'] ? room.energyCapacityAvailable : room.energyAvailable;
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
function getGeneralist(room) {
    const parts = [MOVE, CARRY, MOVE, WORK];
    let partsCost = 0;
    for (let each of parts) {
        partsCost += BODYPART_COST[each];
    }
    const engAvail = room.energyCapacityAvailable;
    const mult = Math.floor(engAvail / partsCost);
    const newBod = Array(mult).fill(parts).flat();
    const totalPartsCost = partsCost * mult;

    return [newBod, totalPartsCost];
}

//Miner - Yeoman
function getMiner(plan){
    let holding = plan.memory.holding;
    let distance = Memory.kingdom.holdings[holding].sources[plan.memory.target].path.length
    let carrySize;
    let workSize;
    let moveSize;
    /*
    Distance Ref
    30:2,
    60:3,
    80:4,
    110:5,
    130:6
    */
    if(distance >= 130) carrySize = 6
    else if(distance >= 110) carrySize = 5
    else if(distance >= 80) carrySize = 4
    else if(distance >= 60) carrySize = 3
    else if(distance >= 30) carrySize = 2
    else{ carrySize = 2}
    if(carrySize>4){
        workSize = 10;
        moveSize = Math.ceil((carrySize+workSize)/2);
    }
    else{
        workSize = 6;
        moveSize = 2;
    }
    let partsCost = 0;
    let optimalEnergy = (carrySize*50)+(workSize*100)+(moveSize*50)
    let homeFief = Game.rooms[Memory.kingdom.holdings[holding].homeFief];
    let energyAvailable = homeFief.energyCapacityAvailable;
    let newBody;
    //Body choice depends on capacity available
    if(energyAvailable >= optimalEnergy){
        newBody = [...Array(carrySize).fill(CARRY),...Array(moveSize).fill(MOVE),...Array(workSize).fill(WORK)];
        plan.memory.doRepair = true;
    }
    else if(energyAvailable >= 800){
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
function getSapper(room){
    let parts = [MOVE,WORK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable

    let maxParts = Math.floor(energyAvailable / setCost);
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for (let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getArcher(room,plan){
    let parts = [MOVE,RANGED_ATTACK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    let maxParts = Math.min(plan.bodySize,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for (let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getPikeman(room,plan){
    let parts = [MOVE,ATTACK]
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let energyAvailable = room.energyCapacityAvailable
    //Max size is the set body size or energy cap, whichever is less
    let maxParts = Math.min(20,Math.floor(energyAvailable / setCost));
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for (let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}
function getSkirmisher(room,plan){
    let parts = [MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,HEAL]
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
    for (let i = 1; i < maxParts && newBody.length + parts.length <= 50 && i <= cap; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}

//General hauler - Porter
function getHauler(room,fiefCreeps){
    let parts = room.storage && room.storage.my ? [MOVE, CARRY, CARRY] : [MOVE,CARRY];
    let partsCap = global.cpuAverage > 90 || room.controller.level == 8 ? 36 : parts.length == 2 ? 28 : 21;
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let maxCap = global.cpuAverage > 90 || room.controller.level < 4 ? room.energyCapacityAvailable : Math.ceil(room.energyCapacityAvailable/2)
    let energyAvailable = (fiefCreeps['hauler'] && fiefCreeps['hauler'].length >= 3) ? maxCap : room.energyAvailable;
    let cap = Math.min(room.controller.level > 3 ? 1800 : 600, energyAvailable);
    let maxParts = Math.floor(cap / setCost);
    let newBody = [];
    let totalCost = 0;

    newBody.push(...parts);
    totalCost += setCost;

    for (let i = 1; i < maxParts && newBody.length + parts.length <= partsCap; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }

    return [newBody,totalCost];
}

//Starter upgrader - Scribe
function getUpgrader(room,fiefCreeps,job){
    let parts = [MOVE,CARRY,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let isStarter = job == 'starterUpgrader';
    let engAvail = (!fiefCreeps.upgrader && isStarter) ? room.energyAvailable : room.energyCapacityAvailable;
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

function getScout(room,fiefCreeps){
    //Make sure we have harvesters and haulers before we do any scouts
    if(!fiefCreeps.harvester || !fiefCreeps.hauler) return ['REGISTRY_BABY_FIEF',-1];
    
    return [[MOVE],50]
}
function getMHarvester(room,job = 'default'){
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
        for (let i = 0; i < newBod.length; i++) {
            if (newBod[i] == WORK) {
                newBod[i] = CARRY;
                partsCost -= BODYPART_COST[WORK] - BODYPART_COST[CARRY];
                break;
            }
        }
    }
    
    return [newBod,partsCost];
}

function getReserver(room,fiefCreeps){
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

//Fortifier - Mason
function getFortifier(room,fiefCreeps){
    let parts = [MOVE,CARRY,WORK];
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

//Builder - Carpenter
function getBuilder(room,fiefCreeps){
    let nonWork = [MOVE,CARRY]
    let fullSet = [MOVE,CARRY,WORK,WORK];
    let fullCost = fullSet.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let totalCost = 0;
    let engAvail = room.energyCapacityAvailable;
    //First see if we have enough to do even a single full set
    if(engAvail < fullCost){
        //If not then we build what we can
        let newBod = nonWork;
        let engLeft = engAvail-newBod.reduce((acc, part) => acc + BODYPART_COST[part], 0);
        let workParts = Math.floor(engLeft/BODYPART_COST[WORK])
        newBod = newBod.concat(Array(workParts))
        totalCost = (engAvail-engLeft)+(workParts*BODYPART_COST[WORK])
        return [newBod,totalCost]
    }
    //Get max sets we can afford, capping at the creep body limit
    let maxSets = Math.min(Math.floor(engAvail/fullCost),Math.floor(MAX_CREEP_SIZE/fullSet.length));
    //Build the body
    let newBod = [];
    for(let i=0;i<maxSets;i++){
        newBod = newBod.concat(fullSet)
        totalCost += fullCost
    }
    //See if we have space to fill with work parts and energy to do so
    if(engAvail-totalCost >= BODYPART_COST[WORK] && newBod.length < MAX_CREEP_SIZE){
        let extraWorks = Math.floor((engAvail-totalCost)/BODYPART_COST[WORK]);
        newBod = newBod.concat(Array(extraWorks).fill(WORK));
        totalCost += extraWorks*BODYPART_COST[WORK];
    }
    
    return [newBod,totalCost]
}
//#endregion