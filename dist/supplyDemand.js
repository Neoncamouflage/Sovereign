const helper = require('functions.helper');
const registry = require('registry');
const profiler = require('screeps-profiler');
const supplyDemand = {
    prepShipping: function(roomName){
        if (!global.heap.shipping) global.heap.shipping = {};
        if (!global.heap.shipping[roomName]){
            global.heap.shipping[roomName] = {};
            global.heap.shipping[roomName].requests = {};
            global.heap.shipping[roomName].utilization = [];
        }
    },
    manageShipping: function(roomName,roomCreeps){
        //Primary management function for a room to handle all supply/demand tasks
        //Run prepShipping for the room to ensure we're set up
        let room = Game.rooms[roomName];
        let unassignedTotal = 0;
        let newUtil = 0;
        let poolHaulers = roomCreeps['hauler']
        const shipping = global.heap.shipping[roomName];
        const MIN_IDLE = 0.12;
        const FILL_REFRESH_TICKS = 50;
        const ROOM_UTIL_MULTIPLE = 100;
        const safeMode = room.controller && room.controller.safeMode;
        const storageEnergy = room.storage ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        const terminalEnergy = room.terminal ? room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        const hasEcoBuffer = storageEnergy >= 10000 || terminalEnergy >= 10000;        
        //Keep a cache of fillable objects
        if(!shipping.fillIds) shipping.fillIds = { tick: 0, ids: [] };
        const fillCache = shipping.fillIds;
        if(Game.time - fillCache.tick >= FILL_REFRESH_TICKS){
            fillCache.tick = Game.time;
            fillCache.ids = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType == STRUCTURE_SPAWN
                        || s.structureType == STRUCTURE_EXTENSION
                        || s.structureType == STRUCTURE_LAB
                        || s.structureType == STRUCTURE_POWER_SPAWN
                        || s.structureType == STRUCTURE_TOWER
            }).map(s => s.id);
        }
        let needRefill = false;
        for(const id of fillCache.ids){
            const struct = Game.getObjectById(id);
            if(!struct) continue;
            const structNeed = struct.store.getFreeCapacity(RESOURCE_ENERGY);
            //if(structNeed <= 0) continue;
            switch(struct.structureType){
                //Towers get refilled below 700 in peacetime
                //Don't refill til we're leaving or soon to be out of safemode
                //This needs to be taken over by the military manager at some point
                case STRUCTURE_TOWER:
                    if(structNeed > 300 && (!safeMode || safeMode < 200)){
                        this.addRequest(room,{
                            type:'dropoff',
                            targetID:struct.id,
                            amount:structNeed,
                            priority:6
                        });
                    }
                    //If it doesn't qualify, make sure it's at least got enough for a few repairs
                    else if(struct.store.getUsedCapacity(RESOURCE_ENERGY) < 100){
                        this.addRequest(room,{
                            type:'dropoff',
                            targetID:struct.id,
                            amount:100,
                            priority:6
                        });
                    }
                    break;
                //Labs get refilled past 1k
                case STRUCTURE_LAB:
                    if(structNeed > 1000){
                        this.addRequest(room,{
                            type:'dropoff',
                            targetID:struct.id,
                            amount:structNeed
                        });
                    }
                    break;
                //Extensions and spawns get dropoff if there's no storage/terminal
                case STRUCTURE_EXTENSION:
                case STRUCTURE_SPAWN:
                    let spawnTicks = struct.spawning ? struct.spawning.remainingTime : null;
                    let needDropoff = structNeed || spawnTicks;
                    if(!hasEcoBuffer && needDropoff){
                        this.addRequest(room,{
                            type:'dropoff',
                            targetID:struct.id,
                            amount:structNeed || struct.store.getFreeCapacity(RESOURCE_ENERGY),
                            priority:9
                        });
                        break;
                    }
                    else if(hasEcoBuffer && structNeed){
                        needRefill = true;
                        break;
                    }
                /*case STRUCTURE_POWER_SPAWN:
                    if(structNeed > 0){
                        this.addRequest(room,{
                            type:'dropoff',
                            targetID:struct.id,
                            amount:structNeed
                        });
                        
                    }
                    break;*/
            }
        }
        if(needRefill) this.addRequest(room,{type:'refill',priority:9,targetID:room.controller.id,amount:room.energyCapacityAvailable - room.energyAvailable});

        //Create utilization variables if they don't exist
        if(!shipping.utilization) shipping.utilization = [];
        if(shipping.utilSum === undefined || shipping.utilSum === null) shipping.utilSum = shipping.utilization.reduce((s,u)=>s+u,0.0);
        if(poolHaulers && poolHaulers.length){
            //Split haulers into state buckets
            let [stateHaulers,storeHaulers] = splitHaulers(poolHaulers,room);
            //console.log("State Haulers:\n",JSON.stringify(stateHaulers));
            //console.log("Store Haulers:\n",JSON.stringify(storeHaulers));

            //Complete pickup/dropoff/refill tasks where possible
            completeTasks(shipping,stateHaulers,room);
            //console.log("State Haulers after completeTasks()",JSON.stringify(stateHaulers.map(h)));
            //Relay from any haulers possible, and use that to update stateHaulers
            stateHaulers = runRelays(storeHaulers);
            //console.log("Going into assignment. State haulers:")
            //for(let i in stateHaulers){
            //    for(let crp of stateHaulers[i]){
                    //console.log(i," - ",crp)
            //    }
            //}
            //console.log("State Haulers after runRelays()",JSON.stringify(stateHaulers));
            //console.log("POST RELAY IDLES\n",stateHaulers['idle'])
            //Assign tasks to idle and returning haulers
            unassignedTotal = assignHaulerTasks(stateHaulers,room);
            //console.log("After assignment. Haulers by state:")
            //for(let crp of poolHaulers){
                //let task = crp.memory.task ? getTaskByID(roomName,crp.memory.task) : null;
                //console.log(crp," - ",task ? task.assignees[crp.id].state : 'No Task')
            //}
            //console.log("State Haulers after assignHaulerTasks()",JSON.stringify(stateHaulers));
            //Continue task progress
            //console.log("PRERUN IDLES\n",stateHaulers['idle'])
            let currentIdle = runHaulerTasks(poolHaulers,room);
            
            
            
            newUtil = currentIdle/poolHaulers.length;


            //console.log("Idle Count:",idleCount,"Total Count:",totalCount,"Post Idles",postIdles)
            //Add the new utilization
        }
        //Add and recalculate the new utilization - 0 by default if no haulers
        shipping.utilization.unshift(newUtil);
        shipping.utilSum += newUtil;
        //If utilization is now past our tracking length, trim and adjust utilSum
        if(shipping.utilization.length > MAX_SHIPPING_UTILIZATION){
            shipping.utilSum -= shipping.utilization.pop();
        }
        if(Game.time % GLOBAL_SPAWN_INTERVAL == 0){
            //Utilization minimum gets increased based on active remote demand vs hauler carry
            let totalCarry = (poolHaulers && poolHaulers.length) ? poolHaulers.reduce((sum,c) => sum + c.store.getCapacity(), 0) : 0;
            let unassignedUtilization = totalCarry/Math.max(unassignedTotal,1);
            let utilization = shipping.utilSum / shipping.utilization.length;
            let holdingMiners = roomCreeps.miner || [];
            let holdingProduction = holdingMiners.reduce((sum,each)=> sum+each.getActiveBodyparts(WORK),0)*ROOM_UTIL_MULTIPLE;
            let holdingUtilization = totalCarry/Math.max(holdingProduction,1);
            //console.log(roomName,"Total Carry",totalCarry,"Unassigned Total", unassignedTotal, "Holding Production",holdingProduction)
            //console.log(roomName,"Checking for hauler spawning.\nUtilization - Overall:",utilization,"Tick:",shipping.utilization[0],"Unassigned:",unassignedUtilization,"Holding:",holdingUtilization)
            utilization = Math.min(utilization,unassignedUtilization,holdingUtilization);
            //Extra check, no spawning if half or more haulers are currently idle
            //console.log(roomName,"Final util:",utilization,"Min Idle over Utilization?",MIN_IDLE > utilization, "Current tick utilization 0.5 or less?",shipping.utilization[0] <= 0.5)
            //Last Update: Added check for unassignedUtilization under 0.5 as we're overspawning haulers
            if((!poolHaulers || poolHaulers.length < 1) || (MIN_IDLE > utilization && shipping.utilization[0] <= 0.3 && unassignedTotal > 0)){
                //Extra check to make sure we have task assignments
                //console.log("Yes2")
                registry.requestCreep({sev:poolHaulers.length > 1 ? 36 : room.storage && room.storage.store[RESOURCE_ENERGY] > 100 ? 100 :  poolHaulers.length > 2 ? 50 : 60,memory:{role:'hauler',fief:roomName,preflight:false}});  
            }
        }
    },
    addRequest: function(room,details){
        //addSupplyRequest(Game.rooms.E46N37,{type:'pickup',resourceType:'energy',amount:0,targetID:'aaa',international:true,priority:5})
        //console.log("Shipping ready!")
        //Adds a request to the room's shipping tasks
        //Details is an object containing task data
        const DEFAULT_PRIORITY = 3;
        //console.log("Add room",room.name)

        if (!room || !(room instanceof Room)) {
            console.log("ERR_NEED_ROOM_OBJECT");
            return -1;
        }


        //If it isn't a fief, assign the homefief if it's a holding, otherwise the closest one
        if(!Memory.kingdom.fiefs[room.name]){
            if(Memory.kingdom.holdings[room.name]){
                room = Game.rooms[Memory.kingdom.holdings[room.name].homeFief];
            }
            else{
                if(!Object.keys(Memory.kingdom.fiefs)) return;
                let pick;
                let pickNum = Infinity;
                Object.keys(Memory.kingdom.fiefs).forEach(fief => {
                    let dist = Game.map.getRoomLinearDistance(room.name, fief);
                    if(dist > 8) return;
                    if(dist < pickNum){
                        pick = fief;
                        pickNum = dist;
                    }
                });
                room = Game.rooms[pick];
            }

        }
        if(!room)return;
        supplyDemand.prepShipping(room.name)
        
        //Shipping tasks have to be retrieved after we assign the room
        let shippingTasks = global.heap.shipping[room.name].requests;
        //Mandatory data. If missing, return error
        if(!details.type || (details.type !== 'refill' && (!details.targetID || !details.amount))){
            console.log(`ERR_MISSING_DETAILS - ${room.name} Type:${!details.type}, TargetID:${!details.targetID}, Amount:${!details.amount}. Details:${JSON.stringify(details)}`)
            return -3;
        }
        if(!details.resourceType) details.resourceType = RESOURCE_ENERGY
        if(!details.international) details.international = false;
        //Check for an existing task for this target and type, update and return ID if already there
        for(let taskID in shippingTasks) {
            let task = shippingTasks[taskID];
            //Refill task logic
            if(details.type == 'refill'){
                if(task.type === 'refill'){
                    if(details.priority && details.priority > task.priority){
                        //console.log("Updated priority")
                        task.priority = details.priority;
                    }
                    else if(!details.priority){
                        details.priority = 9;
                    }
                    return taskID
                }
            }
            //Other logic
            else if (task.targetID == details.targetID && task.resourceType == details.resourceType){
                //Check for priority update
                if(details.priority && details.priority > task.priority){
                    //console.log("Updated priority")
                    task.priority = details.priority;
                }
                else if(!details.priority){
                    details.priority = DEFAULT_PRIORITY;
                }
                if(details.amount> task.amount){
                    task.updateAmount(details.amount)
                    return taskID;
                }
                else{
                    //("Trying to add same amount to shipping task");
                    return taskID;
                }
            }
            else{
                if(!details.priority) details.priority = DEFAULT_PRIORITY;
            }
        }
        //If no match, set up new task.
        let newTask = new Task(room.name,details.type,details.resourceType,details.targetID,details.amount,details.priority,details.international);
        shippingTasks[newTask.taskID] = newTask

        return newTask.taskID; //Returning ID in case the requester wants it for something
    }
}
//#region Hauler Functions
//#endregion

//Split haulers up by state and store usage
function splitHaulers(allHaulers,room){
    let stateHaulers = {idle:[],pickup:[],dropoff:[],refill:[],renew:[]};
    let storeHaulers = {filled:[],free:[]}
    for(let creep of allHaulers){
        if(creep.spawning) continue;
        //State hauler bucket
        if(!creep.memory.task){
            stateHaulers.idle.push(creep);
        }
        else{
            let task = getTaskByID(room.name,creep.memory.task);
            if(!task || !task.assignees[creep.id]){
                delete creep.memory.task;
                stateHaulers.idle.push(creep);
            }
            else{
                let state = task.assignees[creep.id].state;
                if(!stateHaulers[state])stateHaulers[state] = [];
                stateHaulers[state].push(creep);
            }
        }
        //Store hauler bucket
        if(creep.getStoreUsed() > 0){
            storeHaulers.filled.push(creep);
        }
        else{
            storeHaulers.free.push(creep);
        }
    }
    return [stateHaulers,storeHaulers];
}

//Update task completions - turn pickup/dropoff/refill
function completeTasks(shipping,haulers,room){
    //Check the hauler's distance to its target
    //If it can pickup or drop, do so.
    for(let state of ['pickup','dropoff','refill']){
        let newStateArray = []; //New array containing only creeps remaining in this state
        for(let creep of haulers[state]){
            let task = creep.memory.task ? getTaskByID(room.name,creep.memory.task) : null;
            //If the creep doesn't have a task, it shouldn't be in this state. Kick it out.
            if(!task){
                setIdle(creep);
                continue;
            }
            if(creep.store.getUsedCapacity() && (creep.room.storage && creep.pos.getRangeTo(creep.room.storage)) && Object.keys(creep.store)[0] != task.resourceType){
                creep.transfer(creep.room.storage,Object.keys(creep.store)[0])
            }
            //Refillers just need to check if the room is full to complete
            if(state == 'refill'){
                if(room.energyAvailable == room.energyCapacityAvailable){
                    task.remove(room.name);
                    setIdle(creep);
                }
                continue;
            }
            if(state == 'pickup'){
                //If in a pickup state but carrying things, check if it's for a dropoff.
                //If so, swap states. If not, idle.
                if(creep.store.getUsedCapacity()){
                    if(task.type != 'dropoff' || !creep.store.getUsedCapacity(task.resourceType)){
                        setIdle(creep);
                        continue;
                    }
                    else{
                        task.assignees[creep.id].state = 'dropoff';
                        haulers.dropoff.push(creep);
                        continue;
                    }
                }
            }

            //Only pickup/dropoff from here
            //If no task target, the task is invalid. Kill it and reset the creep to idle.
            let taskTarget = Game.getObjectById(task.targetID);
            if(!taskTarget){
                task.remove(room.name);
                setIdle(creep);
                continue;
            }
            if(task.type == 'dropoff' && taskTarget.store.getFreeCapacity(task.resourceType) === 0 && !task.override){
                let noStuff = (!room.storage || !room.storage.store[task.resourceType]) && (!room.terminal || !room.terminal.store[task.resourceType])

                if(noStuff){
                    task.remove(room.name);
                    setIdle(creep);
                    continue;
                }

            }
            //If task type and state don't match, the creep isn't ready to complete (e.g. still picking up energy for a dropoff)
            if(task.type != state){
                newStateArray.push(creep);
                continue;
            }
            //TODO - Add checks for when the creep can't pickup/dropoff
            //Actually do we even need one? If we go to idle every time, then it would fix itself
            //Range of 1 means ready to pick up or drop
            if(creep.pos.getRangeTo(taskTarget) <= 1){
                let intentResponse = 99; //Default response to 99 because OK is 0
                if(state == 'pickup'){
                    //Pickup if it's a resource, otherwise withdraw
                    if(taskTarget instanceof Resource) intentResponse = creep.pickup(taskTarget);
                    else{intentResponse = creep.withdraw(taskTarget,task.resourceType);}
                    if(intentResponse == ERR_FULL){
                        task.unassign(creep,"Full inventory and tried to withdraw/pickup")
                    }
                }
                else if(state == 'dropoff' || state == 'refill'){
                    intentResponse = creep.transfer(taskTarget,task.resourceType);
                    if(intentResponse == ERR_FULL){
                        if(taskTarget.structureType && [STRUCTURE_EXTENSION,STRUCTURE_SPAWN].includes(taskTarget.structureType)){
                            task.remove(room.name);
                        }
                        else task.unassign(creep,"Full target when drying to transfer");

                    }
                }
                //Log if bad response - Figure out what catches to have based on testing
                //if(intentResponse != OK) console.log(`Bad intent response for creep ${creep} trying to ${state}. Response ${intentResponse}`);
                //Successful transfer/withdraw so we lock the store for the next steps
                if(intentResponse == OK){
                    creep.storeLock = true;
                    task.completeRun(creep);
                    setIdle(creep);
                }

                continue;
            }
            //Range of more than one means we aren't there yet
            else{
                newStateArray.push(creep);
            }
        }
        //Update array with only the haulers staying in this state
        haulers[state] = newStateArray;
    }

    //We'll decide assignment based on whether the 'idle' bucket has any creeps in it. So we can return nothing for now.
    return;

    function setIdle(creep){
        if(creep.memory.task){
            let task = getTaskByID(creep.memory.task);
            if(task) task.unassign(creep,"setting to idle")
            delete creep.memory.task;
        }
        haulers['idle'].push(creep);
    }
}

//Process relays where possible
/**
 -- Possible Relay Options --
 1. Filled meeting empty going any direction
    - Filled gives empty the resources, they swap tasks
 2. Filled meeting filled going opposite directions
    - If able to handle the other's tasks, swap tasks
    - If one will be short on energy, transfer some along if needed (assuming store size can handle it)
 3. Filled meeting filled going the same direction
    - If the rear creep can merge their full inventory into the one ahead, do so and drop their current task
 4. Empty meeting empty going opposite directions
    - Just swap tasks
*/
function runRelays(storeHaulers){
    heap.testRelays = [];
    //Direction adjustments
    const ax = [0, 0, 1, 1, 1, 0, -1, -1, -1];
    const ay = [0, -1, -1, 0, 1, 1, 1, 0, -1];
    //As we might be significantly adjusting states, we'll return a new state object
    let newStateHaulers = {idle:[],pickup:[],dropoff:[],refill:[],return:[]};
    //Build a coordinate map for local empties
    let coordMap = {};
    let fullCoordMap = {};
    let mergingFull = new Set();
    let usedEmpties = new Set();
    //Wrapper function to loop around the array
    const wrapDir = (d) => (d < 1 ? 8 : (d > 8 ? 1 : d));
    for(let empty of storeHaulers['free']){
        //If their store is locked then we skip them
        if(!empty.storeLock){
            let coordKey = `${empty.pos.x},${empty.pos.y},${empty.pos.roomName}`
            coordMap[coordKey] = empty;
        }
    }
        for(let full of storeHaulers['filled']){
        //If their store is locked then we skip them
        if(!full.storeLock){
            let coordKey = `${full.pos.x},${full.pos.y},${full.pos.roomName}`
            fullCoordMap[coordKey] = full;
        }
    }
    for(let creep of storeHaulers['filled']){
        //No store locked creeps or ones that don't know which way their target is yet
        let travelData = creep.memory._trav;
        if(creep.storeLock || !travelData || !travelData.path || travelData.path.length <= 1){
            newStateHaulers[getState(creep)].push(creep);
            continue;
        }
        //Skip if we've been merged into
        if(mergingFull.has(creep.id)) continue;
        
        //Pull the next direction for this creep, and use it to check that location for another creep
        let path = creep.memory._trav.path.substr(1);
        let nextDirection = parseInt(path[0], 10);
        //The first point we check is the next step for this creep, then we check the two adjacent directions.
        let dirPlus = wrapDir(nextDirection+1);
        let dirMinus = wrapDir(nextDirection-1);
        /*let nextKeys = [`${creep.pos.x + ax[nextDirection]},${creep.pos.y + ay[nextDirection]},${creep.pos.roomName}`,
                        `${creep.pos.x + ax[dirPlus]},${creep.pos.y + ay[dirPlus]},${creep.pos.roomName}`,
                        `${creep.pos.x + ax[dirMinus]},${creep.pos.y + ay[dirMinus]},${creep.pos.roomName}`];*/
        //Testing out no-diagonal, at least til we get distance checks
        let nextKeys = [`${creep.pos.x + ax[nextDirection]},${creep.pos.y + ay[nextDirection]},${creep.pos.roomName}`]

        let relayTarget;
        let didRelay = false;
        for(let key of nextKeys){
            if(!coordMap[key]){
                continue;
                if(!fullCoordMap[key]) continue;
                //If there's a full one ahead of us, see if we can merge energy and drop our task
                let mergeTarget = fullCoordMap[key];
                if(mergingFull.has(mergeTarget.id)) continue;
                if(mergeTarget.getStoreFree() < creep.getStoreUsed()) continue;
                if(Object.keys(creep.store)[0] != Object.keys(mergeTarget.store)[0]) continue;
                //Looks good at this point
                creep.transfer(mergeTarget,Math.min(creep.store.getUsedCapacity(),mergeTarget.getStoreFree()));
                creep.storeLock = true;
                let task = creep.memory.task ? getTaskByID(creep.memory.fief,creep.memory.task) : null;
                if(task) task.unassign(creep,"Merging with forward creep");
                mergingFull.add(mergeTarget.id);
                continue;
            }
            relayTarget = coordMap[key];
            if(usedEmpties.has(relayTarget.id)) continue;
            //Creeps are only 1 resource right now so we can just count the whole carry capacity
            if(relayTarget.getStoreFree() < creep.getStoreUsed()) continue;
            //This looks like a valid relay target, so we swap tasks, states, and transfer inventory
            let creepTask = creep.memory.task ? getTaskByID(creep.memory.fief,creep.memory.task) : null;
            let creepState = getState(creep);
            let creepRefill = creep.memory.refillTarget;
            let targetTask = relayTarget.memory.task ? getTaskByID(relayTarget.memory.fief,relayTarget.memory.task) : null;
            let targetState = getState(relayTarget);
            let targetRefill = relayTarget.memory.refillTarget;
            //let startMesage = `Creep TaskID: ${creep.memory.task} Creep state: ${getState(creep)} Target TaskID: ${relayTarget.memory.task} Target state: ${getState(relayTarget)}\n`
            let transferResult = creep.transfer(relayTarget,Object.keys(creep.store)[0]);
            //Abandon relay for this creep if the transfer failed and log the error
            if(transferResult != OK){
                console.log(`Relay transfer failed between ${creep} and ${relayTarget}. Error: ${transferResult}`);
                break;
            }
            //Update the tasks if needed
            if(creepTask) creepTask.relayTask(creep,relayTarget);
            if(targetTask) targetTask.relayTask(relayTarget,creep);
            //Update refill targets if needed
            creep.memory.refillTarget = targetRefill;
            relayTarget.memory.refillTarget = creepRefill;
            //With the tasks updated, we still need to update the task IDs in their memory
            relayTarget.memory.task = creepTask ? creepTask.taskID : null;
            creep.memory.task = targetTask ? targetTask.taskID : null;
            //Update states and add to the new object
            setState(creep,targetState);
            setState(relayTarget,creepState);
            newStateHaulers[targetState].push(creep);
            //Lock the stores and add the target to used empties
            creep.storeLock = true;
            relayTarget.storeLock = true;
            usedEmpties.add(relayTarget.id)

            // -- FIX THIS WITH PROPER TRAVEL DATA SWAP
            delete creep.memory._trav
            delete relayTarget.memory._trav


            didRelay = true;
            /*console.log(`Relay finished. Starting state:\n
                ${startMesage}
                Ending State:\n
                Creep TaskID: ${creep.memory.task} Creep state: ${getState(creep)} Target TaskID: ${relayTarget.memory.task} Target state: ${getState(relayTarget)}`)*/
            //console.log(`Relay Target ${relayTarget} TaskID: ${relayTarget.memory.task} Target state: ${getState(relayTarget)} Target getStoreUsed: ${relayTarget.getStoreUsed()} Target getStoreFree: ${relayTarget.getStoreFree()}`);
            break;
        }
        
        //If we didn't do a relay then we add this creep to the state object with its unchanged state
        if(!didRelay) newStateHaulers[getState(creep)].push(creep);
    }
    //We have to loop over all the empties one more time anyway, to get the ones not relayed to
    //So we just push them all to their states here and now
    for(let creep of storeHaulers['free']){
        newStateHaulers[getState(creep)].push(creep)
    }
    return newStateHaulers;
}

function assignHaulerTasks(allHaulers, room) {
    const AUDIT_INTERVAL = 3;
    const idleHaulers = allHaulers['idle'];
    const dropHaulers = allHaulers['dropoff'];
    let unassignedTotal = 0;
    let startingUnassignedTotal = 0;
    const shippingTasks = global.heap.shipping[room.name].requests;
    const heap = global.heap;

    let tasksToProcess = [];
    let unassignedTasks = [];
    let stealTasks = [];
    let newPriorityTasks = [];
    //Track unassigned amounts for the holding manager to reference
    let holdingUnassigned = 0;
    for (const task of Object.values(shippingTasks)) {
        //Audit tasks for cleanup
        if(Game.time % AUDIT_INTERVAL == 0){
            //Make sure the target exists and is relevant
            //When we remove the vision requirement, we'll need to fix this
            //Or even just change it to an expiration timer if the request is international, vision if not
            let taskTarget = Game.getObjectById(task.targetID);
            if(!taskTarget){
                task.remove(room.name);
                continue;
            }
            if(heap.alarms[taskTarget.room.name]){
                task.remove(room.name);
                continue;
            }
            //Make sure the assignees haven't died
            for(const creepID of Object.keys(task.assignees)){
                if(!Game.getObjectById(creepID)) delete task.assignees[creepID];
            }
        }
        const ua = task.unassignedAmount();
        if(task.international && task.resourceType == RESOURCE_ENERGY) holdingUnassigned += ua;
        //
        if (ua > 0) {
            startingUnassignedTotal += ua;
            if(task.tick == Game.time && task.priority >= 8 && task.type == 'dropoff') newPriorityTasks.push(task);
            unassignedTasks.push(task);
        } else if (task.type === 'dropoff' || task.type === 'pickup') {
            // Fully assigned tasks can still be improved by swapping closer haulers in
            stealTasks.push(task);
        }
    }
    heap.fiefs[room.name].holdingUnassigned = holdingUnassigned;
    //console.log("Total remote unassigned for",room.name,holdingUnassigned)
    if (!unassignedTasks.length && !stealTasks.length) return 0;
    if (!idleHaulers.length) return startingUnassignedTotal;

    tasksToProcess = unassignedTasks.concat(stealTasks);
    tasksToProcess.sort((a, b) => {
        const pr = (b.priority || 0) - (a.priority || 0);
        if (pr !== 0) return pr;
        return (a.coreDist || 0) - (b.coreDist || 0);
    });

    // Categorize idle haulers
    const empty = [];
    const byRes = Object.create(null);
    for (const h of idleHaulers) {
        if (h.getStoreUsed() === 0) {
            empty.push(h);
            continue;
        }
        // Assume single resource when not empty
        const resType = Object.keys(h.getStoreObj())[0];
        if (!byRes[resType]) byRes[resType] = [];
        byRes[resType].push(h);
    }

    const terminal = room.terminal;
    const termNeeds = Memory.kingdom.fiefs[room.name] && Memory.kingdom.fiefs[room.name].termNeeds;
    const storage = room.storage;

    const storagePos = storage
        ? storage.pos
        : (Memory.kingdom.fiefs[room.name].roomPlan &&
            Memory.kingdom.fiefs[room.name].roomPlan[4] &&
            Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE] &&
            Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE][0])
            ? new RoomPosition(
                Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE][0].x,
                Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE][0].y,
                room.name
            )
            : new RoomPosition(25, 25, room.name);

    function pickBestCandidate(cands, targetPos, task) {
        if (!cands || !cands.length) return null;

        let bestIdx = -1;
        let bestScore = Infinity;
        const ua = task.unassignedAmount() || 0;

        for(let i = 0; i < cands.length; i++) {
            const h = cands[i];
            let dist = getTileDistance(h.pos, targetPos);

            // Prefer matching smaller UA with smaller carriers (so we don’t waste big haulers on tiny jobs)
            //if (ua > 0 && ua < h.getStoreFree()) dist *= 1.25;

            if (dist < bestScore) {
                bestScore = dist;
                bestIdx = i;
            }
        }

        if (bestIdx === -1) return null;
        return { creep: cands[bestIdx], idx: bestIdx };
    }

    function removeAtSwap(arr, idx) {
        const last = arr.length - 1;
        if (idx !== last) arr[idx] = arr[last];
        arr.pop();
    }

    function removeFromPools(creep) {
        for(let i = 0; i < empty.length; i++) {
            if (empty[i].id === creep.id) {
                removeAtSwap(empty, i);
                break;
            }
        }
        for (const rt of Object.keys(byRes)) {
            const arr = byRes[rt];
            if (!arr) continue;
            for(let i = 0; i < arr.length; i++) {
                if (arr[i].id === creep.id) {
                    removeAtSwap(arr, i);
                    break;
                }
            }
        }
    }

    function canSourceResourceInRoom(resourceType) {
        let termGood = terminal && terminal.store[resourceType] > 0 && (!termNeeds || termNeeds[resourceType] > terminal.store[resourceType]);
        let storeGood = storage && storage.store[resourceType] > 0;
        //Energy check, no assignign for energy if we have less than 5k
        //if(resourceType == RESOURCE_ENERGY){

        //}
        return (termGood || storeGood);
    }

    //keep assigning from a pool until task is satisfied or pool exhausted.
    // `computeAmount(h, task, target)` should return an amount > 0 to assign, or 0 to skip that creep.
    // `extraCheck(h, task, target)` can reject a creep (returns false) without assigning.
    function flowAssignFromPool(cands, task, targetPos, taskTarget, computeAmount, extraCheck) {
        let assignedAny = false;

        //Prevent infinite loops if computeAmount keeps returning 0
        let safety = (cands && cands.length) ? (cands.length * 2) : 0;

        while ((task.unassignedAmount() || 0) > 0 && cands && cands.length && safety-- > 0) {
            const pick = pickBestCandidate(cands, targetPos, task);
            if (!pick) break;

            const h = pick.creep;

            if (extraCheck && !extraCheck(h, task, taskTarget)) {
                // Not eligible right now; remove from this candidate list only and continue
                removeAtSwap(cands, pick.idx);
                continue;
            }

            const amt = computeAmount(h, task, taskTarget);
            if (!amt || amt <= 0) {
                removeAtSwap(cands, pick.idx);
                continue;
            }

            task.assignTo(h, amt);
            removeFromPools(h);
            assignedAny = true;
        }

        return assignedAny;
    }

    // ---- main assignment loop ----
    for (const task of tasksToProcess) {
        if (heap.wardens && heap.wardens[room.name] && task.international) continue;

        const taskTarget = Game.getObjectById(task.targetID);
        if (!taskTarget || !task.amount) {
            task.remove(room.name);
            continue;
        }

        const targetRoom = taskTarget.room && taskTarget.room.name;
        if (targetRoom && global.heap.alarms && global.heap.alarms[targetRoom]) continue;

        let assigned = false;

        // --- REFILL ---
        if (task.type === 'refill') {
            const current = Object.keys(task.assignees).length;
            const totalStore = Object.values(task.assignees || {}).reduce((sum, each) => sum + each.amount, 0);
            const refillGap = room.energyCapacityAvailable - room.energyAvailable;

            if (current >= 6 || (refillGap > 0 && totalStore / refillGap > 0.2)) {
                const refillers = Object.keys(task.assignees)
                    .map(id => Game.getObjectById(id))
                    .filter(c => !!c);

                let furthest = { creep: null, range: 0 };
                for (const c of refillers) {
                    const d = getTileDistance(storagePos, c.pos);
                    if (d > furthest.range) furthest = { creep: c, range: d };
                }

                if (furthest.creep && furthest.range > 25) {
                    const rt = task.resourceType;
                    const energyPick = pickBestCandidate((byRes[rt] || []), storagePos, task);
                    const emptyPick = pickBestCandidate(empty, storagePos, task);

                    const pick =
                        energyPick && emptyPick
                            ? (getTileDistance(energyPick.creep.pos, storagePos) <= getTileDistance(emptyPick.creep.pos, storagePos) ? energyPick : emptyPick)
                            : (energyPick || emptyPick);

                    if (pick && getTileDistance(pick.creep.pos, storagePos) <= (furthest.range / 2)) {
                        task.unassign(furthest.creep, 'Closer refiller found');
                        task.assignTo(pick.creep);
                        removeFromPools(pick.creep);
                        assigned = true;
                    }
                }
            } else {
                //Limit concurrent refillers intentionally.
                if (current === 0) {
                    const first = pickBestCandidate(idleHaulers, storagePos, task);
                    if (first) {
                        task.assignTo(first.creep);
                        removeFromPools(first.creep);
                        assigned = true;
                    }
                } else {
                    const rt = task.resourceType;
                    const energyPick = pickBestCandidate((byRes[rt] || []), storagePos, task);
                    const emptyPick = pickBestCandidate(empty, storagePos, task);
                    const pick =
                        energyPick && emptyPick
                            ? (getTileDistance(energyPick.creep.pos, storagePos) <= getTileDistance(emptyPick.creep.pos, storagePos) ? energyPick : emptyPick)
                            : (energyPick || emptyPick);

                    if (pick) {
                        task.assignTo(pick.creep);
                        removeFromPools(pick.creep);
                        assigned = true;
                    }
                }
            }
        }

        // --- DROPOFF ---
        if (!assigned && task.type === 'dropoff') {
            const rt = task.resourceType;

            //Steal/swap
            if ((task.unassignedAmount() || 0) <= 0 && task.assignees && Object.keys(task.assignees).length) {
                const carrying = (byRes[rt] || []).filter(h => h.getStoreUsed(rt) > 0);
                if (carrying.length) {
                    const best = pickBestCandidate(carrying, taskTarget.pos, task);
                    if (best) {
                        let worst = null;
                        for (const [id, a] of Object.entries(task.assignees)) {
                            const c = Game.getObjectById(id);
                            if (!c) continue;

                            const d = getTileDistance(c.pos, taskTarget.pos);
                            const amt = a && a.amount || 0;

                            if (!worst || d > worst.dist) worst = { creep: c, dist: d, amount: amt };
                        }

                        if (worst && worst.creep) {
                            const cand = best.creep;
                            const candDist = getTileDistance(cand.pos, taskTarget.pos);

                            const STEAL_MIN_DELTA = 8;
                            const STEAL_MAX_RATIO = 0.65;

                            const betterEnough =
                                (worst.dist - candDist) >= STEAL_MIN_DELTA ||
                                (candDist <= worst.dist * STEAL_MAX_RATIO);

                            const stealAmt = Math.min(worst.amount, cand.getStoreUsed(rt));

                            if (betterEnough && stealAmt > 0) {
                                task.unassign(worst.creep, 'Closer dropoff hauler found');
                                task.assignTo(cand, stealAmt);
                                removeFromPools(cand);
                                assigned = true;
                            }
                        }
                    }
                }
            }

            //Flow-fill remaining demand with:
            // 1) haulers already carrying the resource, then
            // 2) empty haulers (only if storage/terminal can source).
             
            if ((task.unassignedAmount() || 0) > 0) {
                const carryingPool = (byRes[rt] || []).filter(h => h.getStoreUsed(rt) > 0);
                assigned = flowAssignFromPool(
                    carryingPool,
                    task,
                    taskTarget.pos,
                    taskTarget,
                    function (h, t) {
                        return Math.min(h.getStoreUsed(rt), t.unassignedAmount() || 0);
                    }
                ) || assigned;

                if ((task.unassignedAmount() || 0) > 0 && empty.length && canSourceResourceInRoom(rt)) {
                    // Use the actual `empty` pool so removals persist.
                    assigned = flowAssignFromPool(
                        empty,
                        task,
                        taskTarget.pos,
                        taskTarget,
                        function (h, t) {
                            // Empty haulers will go pick up then deliver; reserve up to carry cap.
                            return Math.max(Math.min(h.store.getCapacity(), t.unassignedAmount()),0);
                        }
                    ) || assigned;
                }
            }
        }

        // --- PICKUP (flow fill UA with empty haulers) ---
        if (!assigned && task.type === 'pickup') {
            //Steal/swap Pickup
            if ((task.unassignedAmount() || 0) <= 0 && task.assignees && Object.keys(task.assignees).length) {
                if (empty.length) {
                    const best = pickBestCandidate(empty, taskTarget.pos, task);
                    if (best) {
                        let worst = null;
                        for (const [id, a] of Object.entries(task.assignees)) {
                            const c = Game.getObjectById(id);
                            if (!c) continue;

                            const d = getTileDistance(c.pos, taskTarget.pos);
                            const amt = a && a.amount || 0;

                            if (!worst || d > worst.dist) worst = { creep: c, dist: d, amount: amt };
                        }

                        if (worst && worst.creep) {
                            const cand = best.creep;
                            const candDist = getTileDistance(cand.pos, taskTarget.pos);

                            const STEAL_MIN_DELTA = 8;
                            const STEAL_MAX_RATIO = 0.65;

                            const betterEnough =
                                (worst.dist - candDist) >= STEAL_MIN_DELTA ||
                                (candDist <= worst.dist * STEAL_MAX_RATIO);

                            const stealAmt = Math.min(worst.amount, cand.getStoreFree());

                            if (betterEnough && stealAmt > 0) {
                                task.unassign(worst.creep, 'Closer pickup hauler found');
                                task.assignTo(cand, stealAmt);
                                removeFromPools(cand);
                                assigned = true;
                            }
                        }
                    }
                }
            }

            
            if (empty.length && (task.unassignedAmount() || 0) > 0) {
                assigned = flowAssignFromPool(
                    empty,
                    task,
                    taskTarget.pos,
                    taskTarget,
                    function (h, t, tgt) {
                        return Math.min(h.getStoreFree(), t.unassignedAmount() || 0);
                    },
                    function (h, t, tgt) {
                        // TTL safety check (same as your current logic)
                        if (h.ticksToLive < (getTileDistance(h.pos, tgt.pos) * 2) * 1.3) return false;

                        // Dropped-energy decay heuristic (same intent as before)
                        // Commented out for now, need to find a better method
                        /*if (t.resourceType === RESOURCE_ENERGY &&
                            (!tgt.store || (tgt.structureType && tgt.structureType === STRUCTURE_CONTAINER))) {

                            let decayCalcAmount = 9;
                            if (t.international &&
                                (!tgt.room.controller ||
                                    !tgt.room.controller.reservation ||
                                    tgt.room.controller.reservation.username !== Memory.me)) {
                                decayCalcAmount = 5;
                            }

                            const calcAmount = t.unassignedAmount() + (getTileDistance(h.pos, tgt.pos) * decayCalcAmount);
                            if (calcAmount < h.getStoreFree()) return false;
                        } else*/ if (t.resourceType !== RESOURCE_ENERGY && !room.storage && !room.terminal) {
                            return false;
                        }

                        return true;
                    }
                );
            }
        }

        // Update unassigned total
        // Priority 1 tasks are constant, large-scale resources moves that shouldn't be used for this
        let mult = task.international ? 2 : 1;
        if(task.priority > 1)unassignedTotal += (task.unassignedAmount() || 0) * mult;

        // Exit early if we’ve exhausted candidates
        if (!empty.length && !Object.keys(byRes).some(rt => byRes[rt] && byRes[rt].length)) break;
    }

    return unassignedTotal;
}
//Processes all haulers
//We don't create a new state hauler array when assigning tasks, so we have to go through all of them again
function runHaulerTasks(allHaulers,room){
    const handlers = {
        pickup: runPickup,
        dropoff: runDropoff,
        refill: runRefill
    };
    let idles = [];
    for(let creep of allHaulers){
        //console.log("runHaulerTasks for",creep)
        //No task means they're idle
        let task = creep.memory.task ? getTaskByID(creep.memory.fief,creep.memory.task) : null;
        if(!task){
            //console.log("No task, pushing to idle",creep)
            idles.push(creep)
            continue;
        }

        let state = task.assignees[creep.id].state;
        //console.log("Attempting to run",creep,"for state",state)
        if(!handlers[state]) continue; //Unknown state, skip
        const fn = handlers[state];
        let newIdles = fn(creep,room,task);
        idles.push(...newIdles);
    }
    //Now we finish up with all the idles
    //console.log("Running idle creeps",idles)
    idles = runIdles(idles,room);
    return idles.length;
}
function runPickup(creep,room,task){
    let newIdles = [];
    let taskTarget = Game.getObjectById(task.targetID);
    let creepNeed = task.assignedAmount(creep);
    //If the state doesn't match then we're picking up inventory for the dropoff
    if(task.type == 'dropoff'){
        if(!room.storage && !room.terminal){
            //No storage or terminal, we shouldn't be on this mission with this state
            task.unassign(creep,"No storage or terminal for dropoff mission on pickup state");
            newIdles.push(creep);
        }
        else{
            //We pick up from storage or terminal. Use getTileDistance so we get a range even if in different rooms
            let storageDist = room.storage && room.storage.store.getUsedCapacity(task.resourceType) > creepNeed ? getTileDistance(creep.pos,room.storage.pos) : Infinity;
            let terminalDist = room.terminal && room.terminal.store.getUsedCapacity(task.resourceType) > creepNeed ? getTileDistance(creep.pos,room.terminal.pos) : Infinity;
            if(storageDist >= terminalDist){
                if(creep.pos.isNearTo(room.terminal)){
                    creep.withdraw(room.terminal,task.resourceType,creepNeed);
                    setState(creep,'dropoff')
                    creep.storeLock = true;
                    creep.travelTo(taskTarget)
                }
                else{
                    creep.travelTo(room.terminal);
                }
            }
            else{
                if(creep.pos.isNearTo(room.storage)){
                    creep.withdraw(room.storage,task.resourceType,creepNeed);
                    setState(creep,'dropoff');
                    creep.storeLock = true;
                    creep.travelTo(taskTarget)
                }
                else{
                    creep.travelTo(room.storage);
                }
            }
        }
    }
    //If the state matches the task type, we should be heading to the target
    //We know we aren't there yet because otherwise the task would be completed
    else if(task.type == 'pickup'){
        creep.travelTo(taskTarget);
    }
    return newIdles;
}
function runDropoff(creep,room,task){
    let fillables = global.heap.fiefs[room.name].fillableCoords;
    if(fillables && creep.store.getUsedCapacity(RESOURCE_ENERGY)){
        for(const direct of DIRECTIONS_8){
            let newX = creep.pos.x+direct[0];
            let newY = creep.pos.y+direct[1];
            let key = (newX*50)+newY;
            let fill = fillables[key] && Game.getObjectById(fillables[key]);
            //console.log("Fill check for",newX,newY,key,fill);
            //if(fill)console.log(creep,"found fillable",fill)
            if(fill && fill.store.getFreeCapacity(RESOURCE_ENERGY)){
                creep.transfer(fill,RESOURCE_ENERGY);
                creep.storeLock = true;
                break;
            }
        }
    }
    //State should always match because we won't free the hauler until it's empty
    if(creep.getStoreUsed(RESOURCE_ENERGY) == 0){
        task.unassign(creep,room.name)
        return [creep];
    }
    else{
        let taskTarget = Game.getObjectById(task.targetID);
        creep.travelTo(taskTarget);
        return [];
    }
}
function runRefill(creep,room,task){
        let fillables = global.heap.fiefs[room.name].fillableCoords;
        let newIdles = [];
        //Always withdraw from storage if we can
        if(room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && creep.pos.getRangeTo(room.storage)==1)creep.withdraw(room.storage,RESOURCE_ENERGY);
        //If we're empty, go fill up
        if(creep.getStoreUsed(RESOURCE_ENERGY) == 0){
            //console.log(creep,"getting energy for refill",creep.pos)
            let roomStore = room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || 0;
            let roomTerm = room.terminal && room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || 0;
            let roomTarget;
            if(roomStore && roomTerm){
                roomTarget = getTileDistance(creep.pos,room.storage.pos) > getTileDistance(creep.pos,room.terminal.pos) ? room.terminal : room.storage;
            }
            else if(roomStore){
                roomTarget = room.storage;
            }
            else if(roomTerm){
                roomTarget = room.terminal;
            }
            //No storage location, shouldn't be refilling at all
            else{
                //console.log(`Refill task for ${room.name} despite no storage/terminal.`);
                if(task && task.type == 'refill')task.remove(creep.memory.fief);
                newIdles.push(creep);
            }
            if(creep.pos.getRangeTo(roomTarget) > 1){
                creep.travelTo(roomTarget);
            }
            else(creep.withdraw(roomTarget,RESOURCE_ENERGY))
        }
        //If we have energy, go start dropping it off
        else{
            let sourceMap = heap.fiefs[room.name].sourceRefills;
            let otherMap = heap.fiefs[room.name].otherRefills;
            //Get a target if we need one
            if(!creep.memory.refillTarget){
                if(otherMap && otherMap.size) {
                    creep.memory.refillTarget = getRefillTarget(creep, otherMap, room.name);
                }
                else if(sourceMap && sourceMap.size) {
                    creep.memory.refillTarget = getRefillTarget(creep, sourceMap, room.name);
                }
            }
            //If we have a target
            if(creep.memory.refillTarget){
                let removed = false;
                if(!otherMap.has(creep.memory.refillTarget) && !sourceMap.has(creep.memory.refillTarget)){
                    delete creep.memory.refillTarget;
                    if(otherMap && otherMap.size) {
                        creep.memory.refillTarget = getRefillTarget(creep, otherMap, room.name);
                    }
                    else if(sourceMap && sourceMap.size) {
                        creep.memory.refillTarget = getRefillTarget(creep, sourceMap, room.name);
                    }
                    //No refill maps mean we can't refill, so just remove the task and reset the state.
                    else{
                        if(task && task.type == 'refill')task.remove(creep.memory.fief)
                        removed = true;
                        newIdles.push(creep);
                    }
                }
                if(!removed){
                    let [x, y] = creep.memory.refillTarget.split(',').map(num => parseInt(num));
                    let targetPos = new RoomPosition(x, y, room.name);
                    if(creep.pos.getRangeTo(targetPos) > 0){
                        creep.travelTo(targetPos);
                    }
                    else{
                        let refillExt;
                        if(otherMap.has(creep.memory.refillTarget)){
                            refillExt = Game.getObjectById(otherMap.get(creep.memory.refillTarget).values().next().value);
                            creep.transfer(refillExt,RESOURCE_ENERGY);
                            creep.storeLock = true;

                        }
                        else if(sourceMap.has(creep.memory.refillTarget)){
                            refillExt = Game.getObjectById(sourceMap.get(creep.memory.refillTarget).values().next().value);
                            creep.transfer(refillExt,RESOURCE_ENERGY);
                            creep.storeLock = true;
                        }
                    }
                }
            }
            //If we haven't transferred, check for adjacent empties
            if(!creep.storeLock && fillables && creep.store.getUsedCapacity(RESOURCE_ENERGY)){
                for(const direct of DIRECTIONS_8){
                    let newX = creep.pos.x+direct[0];
                    let newY = creep.pos.y+direct[1];
                    let key = (newX*50)+newY;
                    let fill = fillables[key] && Game.getObjectById(fillables[key]);
                    //console.log("Fill check for",newX,newY,key,fill);
                    //if(fill)console.log(creep,"found fillable",fill)
                    if(fill && fill.store.getFreeCapacity(RESOURCE_ENERGY)){
                        creep.transfer(fill,RESOURCE_ENERGY);
                        break;
                    }
                }
            }
        }
    return newIdles;
}
//Idle creeps return back and drop off resources if they're carrying anything, otherwise do nothing
//TODO - Have this return total carry parts for a proper utilization check
function runIdles(idles,room){
    //console.log("IDES:",idles)
    //New set of return idles, so we don't count those sitting around with energy
    let returnIdles = [];
    let tempRefills = [];
    let fillables = global.heap.fiefs[room.name].fillableCoords;
    //Gather up places to dump spare energy
    let spawns = Memory.kingdom.fiefs[room.name].spawns
    let storage = room.storage && room.storage.my && room.storage.store.getFreeCapacity() > 0 ? room.storage : null;
    let terminal = room.terminal && room.terminal.my && room.terminal.store.getFreeCapacity() > 0 ? room.terminal : null;
    let goSpawn = spawns && spawns.length && Game.getObjectById(spawns[0]);
    let goTarget = storage || terminal || goSpawn;

    if(storage || terminal){
        for(const creep of idles){
            if(room.energyAvailable < room.energyCapacityAvailable && creep.getStoreUsed() == creep.getStoreUsed(RESOURCE_ENERGY)){
                    runRefill(creep,room,null);
            }   
            else{
                if(storage && creep.getStoreUsed()){
                    if(creep.pos.getRangeTo(storage) == 1){
                        creep.transfer(storage,Object.keys(creep.store)[0]);
                        creep.storeLock = true;
                    }
                    else{
                        creep.travelTo(storage,{range:1});
                        
                    }
                }
                else if(terminal && creep.getStoreUsed()){
                    if(creep.pos.getRangeTo(terminal) == 1){
                        creep.transfer(terminal,Object.keys(creep.store)[0]);
                        creep.storeLock = true;
                    }
                    else{
                        creep.travelTo(terminal,{range:1});
                    }
                }
                else{
                    returnIdles.push(creep);
                }
            }
            if(!creep.storeLock && fillables && creep.store.getUsedCapacity(RESOURCE_ENERGY)){
                for(const direct of DIRECTIONS_8){
                    let newX = creep.pos.x+direct[0];
                    let newY = creep.pos.y+direct[1];
                    let key = (newX*50)+newY;
                    let fill = fillables[key] && Game.getObjectById(fillables[key]);
                    //console.log("Fill check for",newX,newY,key,fill);
                    if(fill && fill.store.getFreeCapacity(RESOURCE_ENERGY)){
                        creep.transfer(fill,RESOURCE_ENERGY);
                        creep.storeLock = true;
                        break;
                    }
                }
            }
        }
        
        return returnIdles;
    }

    let combos = [];
    for(const creep of idles){
        let controllerRange = creep.pos.getRangeTo(room.controller);
        if(controllerRange <= 7 && creep.getStoreUsed(RESOURCE_ENERGY) && creep.getStoreFree()){
            combos.push(creep);
        }
        else{
            //Get into the general base area if too far away.
            if(controllerRange > 7){
                creep.travelTo(room.controller,{range:5});
            }
            //If we have energy, try to drop it off somewhere
            //Might remove, depends on testing
            //if(creep.getStoreUsed(RESOURCE_ENERGY)){
            //}
        }
        if(!creep.storeLock && fillables && creep.store.getUsedCapacity(RESOURCE_ENERGY)){
            for(const direct of DIRECTIONS_8){
                let newX = creep.pos.x+direct[0];
                let newY = creep.pos.y+direct[1];
                let key = (newX*50)+newY;
                let fill = fillables[key] && Game.getObjectById(fillables[key]);
                //console.log("Fill check for",newX,newY,key,fill);
                if(fill && fill.store.getFreeCapacity(RESOURCE_ENERGY)){
                    creep.transfer(fill,RESOURCE_ENERGY);
                    creep.storeLock = true;
                    break;
                }
            }
        }
    }
    if (combos.length > 1) {
        for(let i = 0; i < combos.length; i++) {
            const comboCreep = combos[i];

            let closest = null;
            let bestRange = Infinity;

            for(let j = 0; j < combos.length; j++) {
                if (j === i) continue;

                const b = combos[j];
                const r = comboCreep.pos.getRangeTo(b.pos); // Screeps
                if (r < bestRange) {
                    bestRange = r;
                    closest = b;
                }
            }
            if(bestRange == 1 && !comboCreep.storeLock){
                if (comboCreep.getStoreUsed() < closest.getStoreUsed()){
                    comboCreep.transfer(closest,Object.keys(comboCreep.getStoreObj)[0]);
                }
            }  
            else{
                comboCreep.travelTo(closest);
            }
        }
    }

    return idles;
}

//Probably need to set up some kind of error code return for this
function setState(creep,newState){
    if(!creep.memory.task) return;
    let task = getTaskByID(creep.memory.fief,creep.memory.task);
    if(!task) return;
    let assignee = task.assignees[creep.id];
    if(!assignee) return;
    //console.log("Setting",creep,"state to",newState)
    assignee.state = newState;
}

function getState(creep){
    const reset = (creep) =>{
        delete creep.memory.task;
        return 'idle';
    }
    if(!creep.memory.task) return 'idle';
    let task = getTaskByID(creep.memory.fief,creep.memory.task);
    if(!task) return reset(creep);
    let assignee = task.assignees[creep.id];
    if(!assignee) return reset(creep);
    return assignee.state;
}

//#region Task Prototype
//#endregion
function Task(fief,type, resourceType, targetID, amount, priority,international,targetRoom,taskID,assignees,tick,opts = {}) {
    this.fief = fief;
    this.taskID = taskID || generateTaskID();
    this.type = type;
    this.resourceType = resourceType;
    this.targetID = targetID;
    this.targetRoom = targetRoom || Game.getObjectById(targetID).room.name
    this.amount = amount;
    this.priority = priority || 1; //Everything above priority 3 is considered for hauler population demand
    this.assignees = assignees || {};
    /* Assignees object structure
    {creepID:{
        state:           What stage of the task the creep is in (pickup/dropoff/etc)
        sources:         If the creep needs to source for the task (picking up for a dropoff), this is the ID for it
                         - Can also later use sources to specify an exact pickup object for the task, for A to B orders
        amount:          The amount on this task that the creep has reserved to complete
        lastUpdate:      Game tick of the last change
        distance:        Distance of the creep from the task, based on path following
        }
    }
    */
    this.international = international || false;
    this.tick = tick || Game.time;
    this.coreDist = getTaskDist(fief,targetID);
    for (const [k, v] of Object.entries(opts)) {
        if (!(k in this)) this[k] = v;
    }
}

Task.prototype.assignTo = function(hauler,amount='default') {       
    let haulerUsed = hauler.getStoreUsed(this.resourceType);
    let haulerFree = hauler.getStoreFree();
    let haulerCap = hauler.store.getCapacity();
    //Assign default amount of as much as possible unless an amount is specified
    let newAssignee = {
        state:null,
        sources:[],
        amount:null,
        lastUpdate:Game.time,
        distance:null
    };
    let unassigned = this.unassignedAmount();
    //This needs some better logic for figuring out if it should pick up energy or drop off what it already has
    if(this.type == 'dropoff'){
        //If the hauler is at max capacity, or is above the unassigned amount, use either of those.
        newAssignee.amount = amount == 'default' || haulerUsed <= 0 ? Math.min(unassigned,haulerCap) : Math.min(amount, haulerUsed, unassigned);
        //console.log("ASSIGNING DROPOPFF",hauler,"Unassigned",unassigned,"Hauler cap",haulerCap,"Hauler used",haulerUsed,"Final amount:",newAssignee.amount)
        if(haulerUsed >= newAssignee.amount)newAssignee.state = 'dropoff';
        else{
            if(haulerUsed)newAssignee.state = "dropoff"
            else{newAssignee.state = "pickup"}
        }
    }
    else if(this.type == 'refill'){
        newAssignee.amount = haulerCap;
        newAssignee.state = 'refill';
    }
    else if(this.type == 'pickup'){
        newAssignee.amount = amount == 'default' ? Math.min(haulerCap,unassigned) : Math.min(amount, haulerCap, unassigned);
        newAssignee.state = 'pickup';
    }
    //Other non-transport tasks will end up here (towing, renewing, etc)
    else{
        //Not sure what should go here yet
    }
    //console.log("Assigning",this.type,"task",this.taskID,"to",hauler);
    this.assignees[hauler.id] = newAssignee;
    hauler.memory.task = this.taskID;
    if(newAssignee.amount <= 0){
        console.log("ASSIGNED NON-POSITIVE AMOUNT",hauler,this.type)
    }
    return newAssignee.amount;
};

//Swaps the assigned creep for a task
Task.prototype.relayTask = function(fromCreep,toCreep){
    let assignee = this.assignees[fromCreep.id];
    if(!assignee){
        console.log(`Task ${fromCreep.memory.task} cannot relay from ${fromCreep} as they are not assigned.`);
        return false;
    }
    const newAssignee = { ...assignee };
    delete this.assignees[fromCreep.id];
    this.assignees[toCreep.id] = newAssignee;
    return true;
}

//Updates the amount requested on a task
Task.prototype.updateAmount = function(newAmount) {
    const oldAmount = this.amount;
    this.amount = newAmount;

    const assigned = Object.keys(this.assignees);
    if (!assigned.length || this.type === 'dropoff') return;

    let remainingAmount = this.unassignedAmount();

    for (const id of assigned) {
        const hauler = Game.getObjectById(id);

        if (!hauler) {
            delete this.assignees[id];
            continue;
        }

        const space = hauler.getStoreFree();
        const oldAssigned = this.assignees[id].amount;

        // If this hauler is already capped by its space, nothing to do; keep checking others
        if (space === oldAssigned) continue;

        // Desired new assignment is previous + whatever we can add (or remove if remaining is negative)
        const desired = remainingAmount + oldAssigned;

        // Clamp so we never assign negative and never exceed space
        const newAssigned = Math.max(0, Math.min(desired, space));

        //console.log("Task", this.taskID, "updating amount from", oldAmount, "to", newAssigned, "for hauler", hauler);
        this.assignees[id].amount = newAssigned;

        // Update remaining by the delta we just changed on this assignee
        remainingAmount += (oldAssigned - newAssigned);

        if (remainingAmount === 0) break;
    }
};

Task.prototype.completeRun = function(hauler) {
    let runAmount = this.assignees[hauler.id].amount;
    //console.log(this.type,"task",this.taskID,"removing",runAmount,"from total",this.amount,"completed by",hauler);
    this.amount -= runAmount;
    if(this.isComplete()){
        //console.log("Task",this.taskID,"complete! Removing!")
        this.remove(hauler.memory.fief);
        return;
    }
    delete this.assignees[hauler.id]
    delete hauler.memory.task;
};

Task.prototype.totalAssignedAmount = function() {
    return Object.values(this.assignees).reduce((sum, each) => sum + each.amount, 0);
};

Task.prototype.assignedAmount = function(creep) {
    return this.assignees[creep.id] && this.assignees[creep.id].amount || 0;
};

Task.prototype.unassignedAmount = function() {
    return Math.max(0,this.amount - this.totalAssignedAmount());
};

Task.prototype.isComplete = function() {
    return this.amount <= 0;
};

function generateTaskID(){
    if(!global.heap.shipping.counterTick || global.heap.shipping.counterTick != Game.time){
        global.heap.shipping.counterTick = Game.time;
        global.heap.shipping.counter = 0
    }
    global.heap.shipping.counter += 1;
    let newID = Game.time.toString()+global.heap.shipping.counter.toString()
    //console.log("Generated task ID",newID)
    return newID;
}

function getTaskByID(fiefName, taskID) {
    if (global.heap.shipping[fiefName] && global.heap.shipping[fiefName].requests[taskID]) {
      return global.heap.shipping[fiefName].requests[taskID];
    }
    //console.log("No task by that ID!",JSON.stringify(taskID))
    return null;
}

Task.prototype.remove = function(fiefName) {
    //Remove this task from all assigned haulers
    for(id of Object.keys(this.assignees)){
        let hauler = Game.getObjectById(id);
        if(hauler){
            //console.log("Removing task",this.taskID,"from",hauler)
            delete hauler.memory.task;
        }
        
    }
    //Delete self
    //console.log("Task",this.taskID,"removed.")
    delete global.heap.shipping[fiefName].requests[this.taskID];
    
};

Task.prototype.unassign = function(hauler,reason) {
    if(!reason) reason = 'No reason.'
    //Remove hauler from task
    //console.log("Unassigning task",reason,JSON.stringify(this),"from hauler",hauler.name)
    if(this.assignees[hauler.id]) delete this.assignees[hauler.id];
    //Delete hauler task
    delete hauler.memory.task
};

function getTaskDist(fief,targetID){
    let target = Game.getObjectById(targetID);
    if(!target) return 0;
    if(Game.rooms[fief].storage) return getTileDistance(Game.rooms[fief].storage.pos,target.pos);
    let plan = Memory.kingdom.fiefs[fief].roomPlan;
    if(plan){
        let storage = plan[4].storage
        let storePos = new RoomPosition(storage.x,storage.y,fief);
        return getTileDistance(storePos,target.pos);
    }
    //No plan just means all tasks are weighted equal
}

function getRefillTarget(creep, map, roomName) {
    if (!map || map.size === 0) return null;
    
    let positions = [];
    for(let coordStr of map.keys()) {
        let currentSetSize = map.get(coordStr).size;
        
        // Parse coordinates and calculate range
        let [x, y] = coordStr.split(',').map(num => parseInt(num));
        let roomPos = new RoomPosition(x, y, roomName);
        let range = creep.pos.getRangeTo(roomPos);
        
        // Calculate a score that balances range and set size
        // Lower score is better: range (smaller is better) minus set size (larger is better)
        let score = range - (Math.floor(currentSetSize/2));
        
        positions.push({
            coordStr: coordStr,
            range: range,
            setSize: currentSetSize,
            score: score
        });
    }
    
    // Sort by the calculated score (lowest score first)
    positions.sort((a, b) => a.score - b.score);
    
    // Return the position with the best score
    return positions.length > 0 ? positions[0].coordStr : null;
}

function galeShapley(requests, haulers, porterPriorityThreshold) {
  const requestArray = Object.values(requests)
  for (const request of requestArray) {
    request.haulers = new MinHeap((hauler) => coordUtils.getRange(request.target.pos, hauler.pos))

    for (const hauler of haulers) {
      if (hauler.memory.role === "porter" && hauler.ticksToLive >= 20 && request.priority >= porterPriorityThreshold) {
        continue
      }

      request.haulers.insert(hauler)
    }
  }

  while (true) {
    const freeRequests = requestArray.filter((request) => {
      if (request.amount <= 0) {
        return false
      }

      if (request.haulers.getSize() === 0) {
        return false
      }

      return true
    })

    if (freeRequests.length === 0) {
      break
    }

    for (const request of freeRequests) {
      const bestHauler = request.haulers.remove()
      const requestBefore = bestHauler.heap.targetRequest
      // target creep has no request. match!
      if (!requestBefore) {
        request.amount -= bestHauler.amount

        if (request.useRate) {
          request.amount += request.useRate * coordUtils.getRange(request.target.pos, bestHauler.pos)
        }

        bestHauler.heap.targetRequest = request
        continue
      }

      // target creep has match. let's compare

      if (requestBefore.priority < request.priority) {
        // priority is low. give up
        continue
      }

      if (
        requestBefore.priority === request.priority &&
        coordUtils.getRange(bestHauler.pos, requestBefore.target.pos) <=
          coordUtils.getRange(bestHauler.pos, request.target.pos) // same priority but not closer
      ) {
        continue
      }

      // high priority or closer. take this creep.
      requestBefore.amount += bestHauler.amount
      if (requestBefore.useRate) {
        requestBefore.amount -= requestBefore.useRate * coordUtils.getRange(requestBefore.target.pos, bestHauler.pos)
      }

      request.amount -= bestHauler.amount
      if (request.useRate) {
        request.amount += request.useRate * coordUtils.getRange(request.target.pos, bestHauler.pos)
      }

      bestHauler.heap.targetRequest = request
    }
  }
}
profiler.registerObject(supplyDemand, 'supplyDemand');
profiler.registerClass(Task, 'Task');
getRefillTarget = profiler.registerFN(getRefillTarget, 'getRefillTarget');
getTaskByID = profiler.registerFN(getTaskByID, 'getTaskByID');
runDropoff = profiler.registerFN(runDropoff, 'runDropoff');
runPickup = profiler.registerFN(runPickup, 'runPickup');
runRefill = profiler.registerFN(runRefill, 'runRefill');
runIdles = profiler.registerFN(runIdles, 'runIdles');
assignHaulerTasks = profiler.registerFN(assignHaulerTasks, 'assignHaulerTasks');
runRelays = profiler.registerFN(runRelays, 'runRelays');
completeTasks = profiler.registerFN(completeTasks, 'completeTasks');
splitHaulers = profiler.registerFN(splitHaulers, 'splitHaulers');
module.exports = supplyDemand;
global.addSupplyRequest = supplyDemand.addRequest;