const registry = {
    //Calculates which creeps, if any, should be spawned from each spawn queue
    calculateSpawns: function(room){
        let fief = Memory.kingdom.fiefs[room.name]
        let spawnQueue = fief.spawnQueue;
        let spawns = fief.spawns.map(spawn => Game.getObjectById(spawn))
        let freeSpawns = [];
        for(each of spawns){
            if(!each.spawning) freeSpawns.push(each);
        }
        //Sort the queue's keys based on severity
        sortedQueue = Object.keys(spawnQueue).sort((a, b) => spawnQueue[b].sev - spawnQueue[a].sev);
        
        //Loop through the keys and calculate if we can spawn
        for(let i = 0; i < sortedQueue.length; i++){
            let each = sortedQueue[i];
            //If there's a body requested, use it. Otherwise, calculate based on creep role.
            let body = spawnQueue[each].body || getBody(spawnQueue[each].memory.role,room)

            let cost = 0;
            for(every of body){
                cost += BODYPART_COST[every];
            }
    
            //Check if spawn has energy
            if(room.energyAvailable >= cost){
                let nextSpawn = freeSpawns.shift();
                spawnCreep(nextSpawn,each,sortedQueue[each])
                sortedQueue.splice(i,1);
                i--;
                delete sortedQueue[each];
            }
        }

    },
    //Spawns a creep
    spawnCreep: function(spawner,name,plan){
        let spawnDir = plan.dir;
        let switchDir = plan.dir;
        //console.log("Spawning with "+switchDir);
        switch(switchDir){
            case 'TOP_LEFT':
                spawnDir = [TOP_LEFT];
                //console.log("TOP_LEFT SPAWN DIR");
                break;
            case 'TOP_RIGHT':
                spawnDir = [TOP_RIGHT];
                //console.log("TOP_RIGHT SPAWN DIR");
                break;
            case 'BOTTOM':
                spawnDir = [BOTTOM];
                //console.log("BOTTOM SPAWN DIR");
                break;
            case 'BOTTOM_LEFT':
                spawnDir = [BOTTOM_LEFT];
                break;
            case 'LEFT':
                spawnDir = [LEFT];
                break;
            case 'TOP':
                spawnDir = [TOP];
                break;
            case 'RIGHT':
                spawnDir = [RIGHT];
                break;
            case 'BOTTOM_RIGHT':
                spawnDir = [BOTTOM_RIGHT];
                break;
            default:
                [LEFT,RIGHT,TOP,BOTTOM,TOP_LEFT,TOP_RIGHT,BOTTOM_LEFT,BOTTOM_RIGHT];
                
        }
        //console.log(spawnDir)
        //console.log(JSON.stringify(plan))
        if(spawner != null && spawner != undefined){
            //console.log(spawner)
            //console.log(exts)
            //Fat creeps get a marker to help Traveler
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
            if(nonMove>movePart*2){
                plan.memory['fat'] = true;
            }
            try{
                var x = spawner.spawnCreep(plan.body, name,{memory:plan.memory,directions:spawnDir});
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
    }
}
        

module.exports = registry;

//#region Creep Body Switch


function getBody(role,room,job='default',target='default'){
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
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable
                    mult = Math.floor(engAvail/partsCost)
                    //Max number of arrays so we don't pass 50 parts
                    let arrMax = Math.floor(50/parts.length)
                    //Fill new body with either the multiple we can afford or the max, whichever is smaller
                    newBod = [].concat(...Array(Math.min(mult,arrMax)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                case 'energyHarvester':
                    return getEHarvester(room)
                default:
                    switch(roomName){
                        default:
                            return [MOVE,WORK,WORK,WORK,WORK,WORK];
                    }       
                    break;
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
        case 'upgrader':
            parts = [MOVE,CARRY,WORK,WORK,WORK,WORK,WORK];
            let partsCost = 0;
            for(each of parts){
                partsCost += BODYPART_COST[each];
            }
            let engAvail = Game.rooms[roomName].energyCapacityAvailable
            mult = Math.floor(engAvail/partsCost)
            //console.log(mult)
            newBod = [].concat(...Array(Math.min(mult,6)).fill(parts));
            //If mult is 2 or more, stuff however many more work parts we can
            if(mult >= 2){
                //Get the total cost of the body
                let totalCost = 0;
                newBod.forEach(b => {
                    totalCost += BODYPART_COST[b];
                });
                //Get how many work parts we can fit in the difference
                let gapParts = Math.floor((engAvail-totalCost)/100);
                newBod = newBod.concat(Array(Math.min(gapParts,50-newBod.length)).fill(WORK));
            }

            //console.log("BODLENGTH",newBod.length)
            return newBod;
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
            switch(job){
                case 'canHauler':
                    parts = [MOVE,CARRY,CARRY];
                    let partsCost = 0;
                    for(each of parts){
                        partsCost += BODYPART_COST[each];
                    }
                    //Get available room energy
                    let engAvail = Game.rooms[roomName].energyCapacityAvailable;
                    //Get the size needed for the trip
                    let canDist= Game.rooms[roomName].storage.pos.getRangeTo(new RoomPosition(Memory.kingdom.fiefs[roomName].sources[target]['spotx'],Memory.kingdom.fiefs[roomName].sources[target]['spoty'],roomName))*2;
                    //Add 2 for pickup/dropoff ticks, plus 5 for small buffer                 
                    canDist +=7;                    
                    //console.log(canDist)
                    let energyNeeded = canDist*10
                    let sizeMult = Math.ceil(energyNeeded/100)
                    mult = Math.floor(engAvail/partsCost)
                    //console.log(sizeMult)
                    newBod = [].concat(...Array(Math.min(mult, sizeMult)).fill(parts));
                    //console.log(newBod)
                    return newBod;
                    break;
                case 'mineralHauler':
                    let parts2 = [MOVE,CARRY,CARRY];
                    let partsCost2 = 0;
                    for(each of parts2){
                        partsCost2 += BODYPART_COST[each];
                    }
                    //Get available room energy
                    let engAvail2 = Game.rooms[roomName].energyCapacityAvailable;
                    //Get the size needed for the trip
                    let canDist2= Game.rooms[roomName].storage.pos.getRangeTo(new RoomPosition(Memory.kingdom.fiefs[roomName].mineral.spot.x,Memory.kingdom.fiefs[roomName].mineral.spot.y,roomName))*2;
                    //Add 2 for pickup/dropoff ticks, plus 5 for small buffer                 
                    canDist2 +=7;                    
                    //console.log(canDist)
                    let energyNeeded2 = canDist2*10
                    let sizeMult2 = Math.ceil(energyNeeded2/100)
                    let mult2 = Math.floor(engAvail2/partsCost2)
                    //console.log(sizeMult)
                    newBod = [].concat(...Array(Math.min(mult2, sizeMult2)).fill(parts2));
                    //console.log(newBod)
                    return newBod;
                case 'refiller':
                    parts = [MOVE,CARRY,CARRY];
                    let total = parts.length*50;
                    let cap = Math.max(Game.rooms[roomName].energyAvailable, 1800);
                    mult = Math.floor(Game.rooms[roomName].energyAvailable/total);
                    newBod = [].concat(...Array(mult).fill(parts));
                    if(newBod.length > 50){
                        newBod.splice(50);
                    }
                    return newBod
                    /*switch(roomName){
                        case 'W29N25':
                            return [MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY];
                            break;
                        case 'W28N25':
                            return [MOVE,CARRY,CARRY];
                            break;
                        case 'W46N42':
                            return [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
                            break;
                        default:
                            return [MOVE,CARRY,MOVE,CARRY,MOVE,CARRY];
                    }*/ 
                    break;
            }
            break;
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



function getEHarvester(room){
    let newBody = [MOVE];
    let partsCost = 0
    let maxWorkParts = 6;
    let energyAvailable = room.energyCapacityAvailable;
    //Default 1 move part
    partsCost += BODYPART_COST[MOVE];
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

//#endregion