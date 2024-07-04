const helper = require('functions.helper');
const granary = require('granary');
const registry = {
    //Associates roles to names
    nameRef: {
        'hauler':'Porter',
        'harvester':'Serf',
        'upgrader':'Scribe'
    },
    //Calculates which creeps, if any, should be spawned from each spawn queue
    calculateSpawns: function(room,fiefCreeps){
        //console.log("Calculating spawns. Tickmod:",Game.time % 3)
        let fief = Memory.kingdom.fiefs[room.name]
        let spawnQueue = global.heap.registry[room.name] || []
        let spawns = fief.spawns.map(spawn => Game.getObjectById(spawn))
        let freeSpawns = [];
        if(!spawnQueue.length) return;
        for(each of spawns){
            if(!each.spawning) freeSpawns.push(each);
        }
        console.log("Queue",JSON.stringify(spawnQueue))
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
                [body,cost] = getBody(newCreep.memory.role,room,(newCreep.memory.job || 'default'),fiefCreeps)
                newCreep.body = body
            }
            
            
            
            //Check if spawn has energy
            console.log(`Checking if ${room.energyAvailable} is enough for ${cost} to build ${newCreep.body}`)
            if(room.energyAvailable >= cost){
                let nextSpawn = freeSpawns.shift();
                let newName = this.nameRef[newCreep.memory.role]+' '+helper.getName()+' of House '+room.name;
                let spawnTry = this.spawnCreep(nextSpawn,newName,newCreep)

                //If we successfully spawned and this was a respawn request from a creep, update them
                if (spawnTry == OK && newCreep.respawn) Game.getObjectById(newCreep.respawn).memory.respawn = true;
            }
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
                var x = spawner.spawnCreep(plan.body,name,{memory:plan.memory});
                return x;
                console.log("Spawn result",x)
            }
            catch(e){
                console.log(name+'spawn error '+e)
            }
            //Track spawn uptime by logging the spawn call
            if(x == 0){
                //console.log("SUCCESS")
                //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
                Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id].push({gameTime:Game.time,bodySize:plan.body.length});
                //console.log(JSON.stringify(Memory.kingdom.fiefs[spawner.room.name].spawnUptime[spawner.id]))
            }
            //console.log(name+'\n'+)
            //console.log(x)
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

//#region Creep Body Switch


function getBody(role,room,job='default',fiefCreeps){
    let parts;
    let mult;
    let newBod;
    switch(role){
        case 'harvester':
            switch(job){
                case 'mineralHarvester':
                    parts = [MOVE,WORK,WORK,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = room.energyCapacityAvailable
                    mult = Math.floor(engAvail/partsCost)
                    //Max number of arrays so we don't pass 50 parts
                    let arrMax = Math.floor(50/parts.length)
                    //Fill new body with either the multiple we can afford or the max, whichever is smaller
                    newBod = [].concat(...Array(Math.min(mult,arrMax)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'energyHarvester':
                    return getEHarvester(room,fiefCreeps)
            }
            break;
        case 'remoteDefender':
            switch(roomName){
                case 'W29N25':
                    switch(job){
                        case 'remoteDefender':
                            return [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK];
                            break;
                        case 'core':
                            return [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                            break;
                    }
                case 'W28N25':
                    switch(job){
                        case 'remoteDefender':
                            return [TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK];
                            break;
                        case 'core':
                            return [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];
                            break;
                    }
                default:
                    return [MOVE,MOVE,WORK,WORK];
            }       
            break;
        case 'guard':
            return [MOVE,MOVE,ATTACK,ATTACK]
        case 'generalist':
            switch(job){
                case 'generalist':
                    parts = [MOVE,CARRY,MOVE,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(mult)
                    newBod = [].concat(...Array(mult).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'crasher':
                    console.log("Crash firing")
                    parts = [MOVE,MOVE,CARRY,WORK];
                    let partsCost2 = 0;
                    for(each of parts){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail2 = Game.rooms[roomName].energyAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail2/partsCost2)
                    //console.log('CRASH MULT', mult)
                    //console.log(mult)
                    newBod = [].concat(...Array(mult).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'remote':
                    switch(roomName){
                        case 'W28N24':
                            return [MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK];
                            break;
                        case 'W17N27':
                            return [MOVE,MOVE,MOVE,MOVE,CARRY,CARRY,WORK,WORK]
                            break;
                        case 'W29N21':
                            return [MOVE,MOVE,MOVE,CARRY,CARRY,MOVE,WORK,WORK]
                            break;
                        case 'W24N19':
                            return [MOVE,MOVE,MOVE,CARRY,CARRY,MOVE,WORK,WORK]
                            break;
                        case 'W19N23':
                            return [MOVE,MOVE,MOVE,CARRY,MOVE,CARRY,MOVE,WORK,WORK,WORK]
                            break;
                        case 'W18N26':
                            return [MOVE,MOVE,MOVE,CARRY,WORK,WORK]
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,WORK];
                    }       
                    break;
            }      
            break;    
        case 'manager':
            return [MOVE,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY,CARRY];
        case 'claimer':
            switch(job){
                case 'reserver':
                    switch(roomName){
                        case 'W39N46':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        case 'W46N42':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        default:
                            return [MOVE,CLAIM];
                    }       
                    break;
                case 'attacker':
                    switch(roomName){
                        case 'W39N46':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        case 'W46N42':
                            return [MOVE,CLAIM,MOVE,CLAIM];
                            break;
                        default:
                            return [MOVE,CLAIM];
                    }       
                    break;
            }
        case 'miner':
            switch(roomName){
                case 'W39N46':
                    return [MOVE,MOVE,WORK,WORK,WORK,WORK,WORK];
                    break;
                case 'W46N42':
                    return [MOVE,MOVE,CARRY,CARRY,WORK];
                    break;
                default:
                    return [MOVE,MOVE,CARRY,WORK,WORK,WORK,WORK,WORK,WORK];
            }
            break;
        case 'trucker':
            switch(roomName){
                case 'W39N46':
                    switch(job){
                        case 'linkHauler':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        case 'canHauler':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,WORK,WORK];
                    }
                    
                default:
                    return [MOVE,CARRY,WORK,WORK];
            }
            break;
        case 'hauler':
            return getHauler(room);
        case 'upgrader':
            return getUpgrader(room)
        case 'builder':
            switch(job){
                case 'homeBuilder':
                    parts = [MOVE,MOVE,CARRY,CARRY,WORK,WORK];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(mult)
                    newBod = [].concat(...Array(Math.min(mult,4)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'fortBuilder':
                    parts = [MOVE,CARRY,WORK,WORK,WORK,WORK,WORK];
                    let partsCost2 = 0;
                    for(each of parts){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Add work/move cost
                    let engAvail2 = Game.rooms[roomName].energyCapacityAvailable
                    //Minus 150 for the work/carry base, then see how many move/carries we can add
                    mult = Math.floor(engAvail2/partsCost2)
                    //console.log(mult)
                    newBod = [].concat(...Array(Math.min(mult,7)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'remoteBuilder':
                    switch(roomName){
                        case 'W39N46':
                            //console.log("REMOTE")
                            return [MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,CARRY,MOVE,CARRY];
                    } 
                    break;
            }
            break;
    }
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
    let energyAvailable = tickNet > 0 || avgNet > 0 || fiefCreeps['harvester'] ? room.energyCapacityAvailable : room.energyAvailable;
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

//General hauler - Porter
function getHauler(room){
    //console.log("Firing Hauler")
    let parts = room.controller.level > 2 ? [MOVE, CARRY, CARRY] : [MOVE,CARRY];
    let setCost = parts.reduce((acc, part) => acc + BODYPART_COST[part], 0);
    let [tickNet,avgNet] = granary.getIncome(room.name)
    //If we have 0 average and planned, and no haulers, the energy is what we have now, otherwise we wait for at least half of max
    let energyAvailable = tickNet > 0 || avgNet > 0 || fiefCreeps['hauler'] ? Math.max(room.energyCapacityAvailable/2,room.energyAvailable) : room.energyAvailable;
    let cap = Math.min(1800, energyAvailable);
    let maxParts = Math.floor(cap / setCost);
    let newBody = [];
    let totalCost = 0;
    console.log(`Max parts: ${maxParts}, energyAvailable: ${energyAvailable}, setCost: ${setCost}, cap: ${cap}`)
    newBody.push(...parts);
    totalCost += setCost;
    //Add parts til we hit part or energy cap
    for (let i = 1; i < maxParts && newBody.length + parts.length <= 50; i++) {
        newBody.push(...parts);
        totalCost += setCost;
    }
    //console.log("Hauler body",newBody)
    return [newBody,totalCost];
}

//Starter upgrader - Scribe
function getUpgrader(room){
    let parts = [MOVE,CARRY,WORK];
    let partsCost = 0;
    for(each of parts){
        partsCost += BODYPART_COST[each];
    }
    let engAvail = Game.rooms[room.name].energyCapacityAvailable
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
//#endregion