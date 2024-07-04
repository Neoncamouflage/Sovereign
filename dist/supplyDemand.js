const helper = require('functions.helper');
const registry = require('registry');

const supplyDemand = {
    prepShipping: function(roomName){
        if (!global.heap) global.heap = {};
        if (!global.heap.shipping) global.heap.shipping = {};
        if (!global.heap.shipping[roomName]){
            global.heap.shipping[roomName] = {};
            global.heap.shipping[roomName].requests = {};
            global.heap.shipping[roomName].utilization = [];
        }
    },
    manageShipping: function(roomName,fiefCreeps){
        
        //Primary management function for a room to handle all supply/demand tasks
        //Run prepShipping for the room to ensure we're set up
        let room = Game.rooms[roomName];
        let fief = Memory.kingdom.fiefs[roomName]
        let terminal = room.terminal;
        let storage = room.storage;
        let poolHaulers = fiefCreeps;
        //No nuker because it takes so much energy. Only fill upon explicit request
        let fillStructures = [
            STRUCTURE_SPAWN,
            STRUCTURE_EXTENSION,
            STRUCTURE_LAB,
            STRUCTURE_POWER_SPAWN,
            STRUCTURE_TOWER
        ]
        const MAX_IDLE = 0.1;

        //global.heap.shipping[roomName].forEach(task =>{
            //console.log(JSON.stringify(task));
        //})

        //Manage imports/exports

        //Process infrastructure energy demands (extensions,spawns,towers,labs)
        let energyStructures = [];
        //Only check every 6 ticks
        if(Game.time % 6 == 0){
            energyStructures = room.find(FIND_MY_STRUCTURES,{filter: 
                (structure) => fillStructures.includes(structure.structureType) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        }
        //If any need energy, set up tasks
        if(energyStructures.length){
            energyStructures.forEach(struct =>{
                let structNeed = struct.store.getFreeCapacity(RESOURCE_ENERGY);
                console.log("Structure need for",struct.structureType,"is",struct.store.getFreeCapacity(RESOURCE_ENERGY))
                switch(struct.structureType){
                    
                    //Towers get refilled below 700 in peacetime
                    //Don't refill til we're leaving or soon to be out of safemode
                    case STRUCTURE_TOWER:
                        if(structNeed > 300 && (!room.controller.safeMode || room.controller.safeMode < 500)){
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed,
                                priority:9
                            });
                        }
                        //If it doesn't qualify, make sure it's at least got enough for a few repairs
                        else if(struct.store.getUsedCapacity(RESOURCE_ENERGY) < 100){
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:100,
                                priority:9
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
                    //Labs get refilled past 3k
                    case STRUCTURE_POWER_SPAWN:
                        if(structNeed > 3000){
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed
                            });
                            
                        }
                        break;
                    //Spawns and extensions always get added
                    case STRUCTURE_SPAWN:
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed,
                                priority:9
                            });
                        break;
                    case STRUCTURE_EXTENSION:
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed,
                                priority:9
                            });
                        break;
                }
            });

        };

        //Handle in-room haulers, get idle count in return
        if(poolHaulers && poolHaulers.length){
            this.assignTasks(poolHaulers,room)
            let idleCount = this.runHaulers(room,poolHaulers);
            //console.log("Idle count",idleCount)
            global.heap.shipping[roomName].utilization.unshift(idleCount/poolHaulers.length)

            //If utilization is past our tracking length, trim
            if(global.heap.shipping[roomName].utilization.length > 50) global.heap.shipping[roomName].utilization.length = 50;
        }
        //If no haulers, utilization is set to 0 by default
        else{
            global.heap.shipping[roomName].utilization.unshift(0)
        }
        //Calculate utilization and request more haulers if needed
        let utilization = global.heap.shipping[roomName].utilization.reduce((sum,util) => sum+util,1) / global.heap.shipping[roomName].utilization.length
        if(utilization < MAX_IDLE){
            registry.requestCreep({sev:poolHaulers.length > 2 ? 20 : 60,memory:{role:'hauler',fief:roomName,preflight:false}})
        }
        //console.log(`Hauler utilization: ${utilization}`)
        //console.log(global.heap.shipping[roomName].utilization)
    },
    addRequest: function(room,details){
        //console.log("Shipping ready!")
        //Adds a request to the room's shipping tasks
        //Details is an object containing task data
        const DEFAULT_PRIORITY = 5;
        //console.log("Add room",room.name)
        let shippingTasks = global.heap.shipping[room.name].requests;

        if (!(room instanceof Room)) {
            console.log("ERR_NEED_ROOM_OBJECT");
            return -1;
        }


        //Mandatory data. If missing, return error
        if(!details.type || !details.targetID || !details.amount){
            console.log("ERR_MISSING_DETAILS")
            return -1;

        }
        if(!details.resourceType) details.resourceType = RESOURCE_ENERGY
        //Check for an existing task for this target and type, update and return ID if already there
        for (let taskID in shippingTasks) {
            let task = shippingTasks[taskID];
            //Check for priority update
            if(details.priority && details.priority > task.priority){
                console.log("Updated priority")
                task.priority = details.priority;
            }
            if (task.targetID == details.targetID && task.resourceType == details.resourceType){
                if(details.amount> task.amount){
                    task.updateAmount(details.amount)
                    return taskID;
                }
                else{
                    console.log("Trying to add same amount to shipping task");
                    return -1;
                }
            }
        }
        //If no match, set up new task.
        let newTask = new Task(details.type,details.resourceType,details.targetID,details.amount)
        shippingTasks[newTask.taskID] = newTask

        return newTask.taskID; //Returning ID in case the requester wants it for something
    },
    assignTasks: function(allHaulers,room){
        //Assigns tasks to creeps based on capacity
        //Returns 0 if a task is found or -1 if not
        let shippingTasks = global.heap.shipping[room.name].requests;
        //Every 5 ticks, check assigned haulers to see if we need to clear them out.
        if(Game.time % 5 == 0){
            Object.values(shippingTasks).forEach(task=>{
                let haulIDs = Object.keys(task.assignedHaulers);
                haulIDs.forEach(crpID =>{
                    if(!Game.getObjectById(crpID)) delete task.assignedHaulers[crpID]
                })
            })
        }
        console.log("Current supply/demand tasks",JSON.stringify(shippingTasks))
        
        let unassignedTasks = Object.values(shippingTasks).filter(task => task.unassignedAmount() > 0);
        let terminal = room.terminal;
        let storage = room.storage;
        console.log("Current unfilled supply/demand tasks",JSON.stringify(unassignedTasks))

        //Split off specifically the idle haulers for now
        let idleHaulers = allHaulers.filter(hauler => hauler.memory.state == "idle");
        //If no unassigned tasks or free haulers, return
        if(!Object.keys(unassignedTasks).length || !idleHaulers.length) return;

        //Split up empty and non-empty haulers
        let emptyHaulers = [];
        let haulersByResource = {};
        
        //Only works for single resources right now, fix for multiple later
        idleHaulers.forEach(hauler => {
            if (hauler.store.getUsedCapacity() != 0) {
              let resType = Object.keys(hauler.store)[0]
                if(!haulersByResource[resType]) {
                    haulersByResource[resType] = [];
                }
                haulersByResource[resType].push(hauler);
            }
             else {
              emptyHaulers.push(hauler);
            }
        });
        console.log("BE RESOURCE",JSON.stringify(haulersByResource))
        console.log("BE EMPTY",emptyHaulers)
        //Prioritize
        unassignedTasks.sort((a, b) => b.severity - a.severity);
        //Assign tasks to closest haulers, preferring ones already carrying the resource if possible
        //Should probably check at the end to see if we still have unassigned but this works for now.
        Object.values(unassignedTasks).forEach(task => {
            console.log("Checking task",task.taskID,"type",task.type,"has an amount",task.amount,"with unassigned",task.unassignedAmount())
            let hauler = null;
            let taskTarget = Game.getObjectById(task.targetID);
            //If no valid target or amount, bad task. Remove
            if(!taskTarget || !task.amount){
                task.remove(room.name);
                return;
            }
            console.log("Valid target")
            //If dropoff, check if there are haulers for the required resource
            if (task.type === 'dropoff' && haulersByResource[task.resourceType] && haulersByResource[task.resourceType].length > 0) {
                //Get creeps that can fill right away
                eligibles = haulersByResource[task.resourceType].filter(haul => haul.store.getUsedCapacity(task.resourceType) >= task.unassignedAmount())
                //If any can fill right away, get the closest
                if(eligibles.length){
                    hauler = taskTarget.pos.findClosestByRange(eligibles);
                    haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== hauler.id);
                    task.assignTo(hauler);
                }
                //Else if we have a terminal or storage, just find any
                else if(terminal || storage){
                    hauler = taskTarget.pos.findClosestByRange(haulersByResource[task.resourceType]);
                    haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== hauler.id);
                    task.assignTo(hauler);
                }
                //Else if we don't have a terminal or storage, then assign with limited amounts
                else{
                    hauler = taskTarget.pos.findClosestByRange(haulersByResource[task.resourceType]);
                    haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== hauler.id);
                    task.assignTo(hauler,hauler.store.getUsedCapacity(task.resourceType));
                }            
            }


            //If no specific resource hauler is available or not dropoff, use closest empty idle hauler
            //Task can be dropoff if there is a terminal or storage available with the resource amount needed
            if (!hauler && emptyHaulers.length > 0 && (task.type != 'dropoff' || (terminal && terminal.store[task.resourceType] > task.unassignedAmount()) || (storage && storage.store[task.resourceType] > task.unassignedAmount()))) {
                console.log("Checking idle haulers now")
                checkHauler = taskTarget.pos.findClosestByRange(emptyHaulers);
                //Check first to see if its a pickup for a dropped energy resource. If so, don't assign unless it's at least 80% capacity.
                if(!(task.resourceType == RESOURCE_ENERGY && !taskTarget.store) || task.unassignedAmount()+(checkHauler.pos.getRangeTo(taskTarget)*18) >= checkHauler.store.getFreeCapacity(RESOURCE_ENERGY)){
                    hauler = checkHauler;
                    emptyHaulers = emptyHaulers.filter(h => h.id !== hauler.id);
                    task.assignTo(hauler);
                    console.log(hauler.name,"assigned")
                }
                
            }

            //If we found one, assign the task. If we didn't, log it
            if (!hauler){
                console.log("No hauler found for task ID",task.taskID,"Type:",task.type,"Item:",task.resourceType)
            }
        });
    },
    //Haulers is an array of all hauler creeps in the room
    runHaulers: function(room,haulers) {
        const IDLE = 'idle';
        const PICKUP = 'pickup';
        const DROPOFF = 'dropoff';
        const RENEW = 'renew';
        const STATES = [IDLE,PICKUP,DROPOFF,RENEW];
        let isIdle = 0;
        
        haulers.forEach(creep => {
            //Deathcheck every 3 ticks to match spawn timing
            if(Game.time % 3 == 0 && creep.ticksToLive <= CREEP_SPAWN_TIME*creep.body.length && !creep.memory.respawn){
                let utilization = global.heap.shipping[room.name].utilization.reduce((sum,util) => sum+util,1) / global.heap.shipping[room.name].utilization.length
                
                //Check utilization to make sure we aren't respawning when not needed
                if(utilization < 0.4){
                    registry.requestCreep({sev:30,memory:{role:'hauler',fief:room.name,preflight:false},respawn:creep.id})
                }
            }
            let oldState = creep.memory.state;
            let state = creep.memory.state;
            //If the creep's state is not in the list of hauler states, skip.
            //Unfamiliar state means logic is taken over by another handler, likely combat
            if(creep.spawning) return;
            if(state && !STATES.includes(state)){
                return;
            };
            //If assigned 0 qty on task, remove it
            if(creep.memory.task){
                let checkTask = getTaskByID(creep.memory.fief,creep.memory.task);
                if(!checkTask) delete creep.memory.task
                else if(checkTask.assignedHaulers[creep.id] <= 0 || checkTask.assignedHaulers[creep.id] == null) checkTask.unassign(creep) 
            }
            //If no state, or no task but a non-idle state, assign idle
            if(!state || (!creep.memory.task && creep.memory.state != IDLE)){
                state = IDLE;
                creep.memory.state = IDLE;
            }
            
            //console.log("Hauler",creep.name,'task:',JSON.stringify(creep.memory.task),'state:',creep.memory.state)
            if(state == IDLE){
                if(creep.memory.task){
                    //Got a task
                    let newTask = getTaskByID(creep.memory.fief,creep.memory.task);
                    
                    if(newTask == null){
                        delete creep.memory.task;
                        return;
                    }
                    console.log(creep.name,"new task!")
                    let resourceType = newTask.resourceType
                    //console.log("New task type",newTask.type)
                    //If demand task
                    if(newTask.type == 'dropoff'){
                        //Are we carrying enough of what we need
                        if(creep.store.getUsedCapacity(resourceType) >= newTask.assignedHaulers[creep.id]){
                            //If so, set state to dropoff
                            creep.memory.state = DROPOFF;
                            state = DROPOFF;
                        }
                        //Else, set state to pickup
                        else{
                            creep.memory.state = PICKUP;
                            state = PICKUP;
                        }
                    }
                    else if(newTask.type == 'pickup'){
                        //Do we have room for it
                        //Would there ever be an assignment situation where we didn't?
                        if(creep.store.getFreeCapacity() > newTask.assignedHaulers[creep.id]){
                            //If so, switch to pickup
                            creep.memory.state = PICKUP;
                            state = PICKUP;
                        }
                        else{
                            //If not, switch to dropoff
                            creep.memory.state = DROPOFF;
                            state = DROPOFF;
                        }
                    }
                }
                else{
                    //No task
                    //Increment idle counter when we get one

                    //If creep has stuff, dump it
                    if(creep.store.getUsedCapacity() > 0){
                        creep.emptyStore();
                    }
                }
            }

            if(state == PICKUP){
                let task = getTaskByID(creep.memory.fief,creep.memory.task);
                if(task == null){
                    delete creep.memory.task;
                    return;
                }
                //Are we on a pickup task? If so, head to the target and take the resource
                if(task.type == 'pickup'){
                    let pickTarget = Game.getObjectById(task.targetID);
                    if(!pickTarget || pickTarget == null){
                        console.log("Bad picktarget",task.targetID)
                        task.remove(creep.memory.fief)
                        creep.memory.state = IDLE;
                    }
                    
                    else if(creep.pos.getRangeTo(pickTarget) > 1){
                        creep.travelTo(pickTarget)
                    }
                    else{
                        //Check for a store to see if it's a resource
                        if(!pickTarget.store){
                        //If we're in range, withdraw and finish the task
                        let x = creep.pickup(pickTarget);
                        //console.log(x)
                        task.completeRun(creep)
                        creep.memory.state = IDLE;
                        }
                        else{
                        //If we're in range, withdraw and finish the task
                        let x = creep.withdraw(pickTarget,task.resourceType);
                        //console.log(x)
                        task.completeRun(creep)
                        creep.memory.state = IDLE;
                        }
                    }
                }
                else if(task.type == 'dropoff'){
                    let resourceType = task.resourceType;
                    //Quick check to see if we're on the right track
                    //If we're picking up for a demand task, see if we have enough
                    if(creep.store[task.resourceType] >= task.assignedHaulers[creep.id]){
                        //If so, set dropoff
                        creep.memory.state = DROPOFF
                    }
                    else{
                        //If not, dump and get it from terminal/storage, whichever has more
                        //If pulling energy, no amount specified so we multi-fill
                        let amountPick = resourceType == RESOURCE_ENERGY ? null : task.assignedHaulers[creep.id];
                        if(creep.room.storage && creep.room.terminal){
                            if(creep.room.storage.store.getUsedCapacity(resourceType) >= creep.room.terminal.store.getUsedCapacity(resourceType)){
                                //dumpAndGet() dumps extra materials and gets up to an amount of resource
                                creep.dumpAndGet(creep.room.storage,resourceType,amountPick);
                            }else{
                                creep.dumpAndGet(creep.room.terminal,resourceType,amountPick);
                            }
                        }
                        else if(creep.room.storage){
                            creep.dumpAndGet(creep.room.storage,resourceType,amountPick);
                        }
                        else if(creep.room.terminal){
                            creep.dumpAndGet(creep.room.terminal,resourceType,amountPick);
                        }
                        //If no storage or terminal, throw alert and kill task. Move to idle.
                        else{
                            console.log(creep.name,"unable to complete task!",JSON.stringify(task)," No pickup location. Hauler has",creep.store[task.resourceType]);
                            task.remove(creep.memory.fief)
                            creep.memory.state = IDLE;
                            return;
                        }
                    }
                }
                
            }
            else if(state == DROPOFF){
                let task = getTaskByID(creep.memory.fief,creep.memory.task);
                if(task == null){
                    delete creep.memory.task;
                    return;
                }
                //Are we on a dropoff task? If so, go to target and transfer
                if(task.type == 'dropoff'){
                    let dropTarget = Game.getObjectById(task.targetID);
                    if(creep.pos.getRangeTo(dropTarget) > 1){
                        creep.travelTo(dropTarget)
                    }
                    else{
                        //If we're in range, transfer and finish the task
                        creep.transfer(dropTarget,task.resourceType);
                        task.completeRun(creep)
                        creep.memory.state = IDLE;
                        return;
                    }
                }
                else if(task.type == 'pickup'){
                    //If we're dumping cargo for a pickup task, see if we have space yet
                    if(creep.store.getFreeCapacity(task.resourceType) >= task.assignedHaulers[creep.id]){
                        //If so, set pickup
                        creep.memory.state = PICKUP
                    }
                    else{
                        //If not, empty
                        if(creep.room.storage || creep.room.terminal){
                            creep.emptyStore();
                        }
                        //If no storage or terminal, throw alert and kill task. Move to idle.
                        else{
                            console.log(creep.name,"unable to complete task! No storage/terminal for",task.resourceType);
                            task.remove(creep.memory.fief)
                            creep.memory.state = IDLE;
                        }
                    }
                }
            }
            else if(state == RENEW){
                //Dunno what this will do yet
            }
            
            if(state==IDLE){
                //console.log("State is idle")
                isIdle++;
            }

            //If all of its space isn't reserved, pick up anything on the ground nearby
            if(creep.memory.task){
                let resTask =  getTaskByID(room.name,creep.memory.task);
                let reserved = resTask.assignedHaulers[creep.id]
                if(reserved<creep.store.getFreeCapacity()){
                    let drops = room.lookForAtArea(LOOK_RESOURCES,creep.pos.y-1,creep.pos.x-1,creep.pos.y+1,creep.pos.x+1);
                    //If drops
                    //If a pickup task and the drop amount is less than our free space plus reserved
                    //Or if a dropoff task and we already have enough on us for the drop
                    if(drops.length && ((resTask.type == 'pickup' && drops[0].amount < creep.store.getFreeCapacity()-reserved) || (resTask.type == 'dropoff' && creep.store.getUsedCapacity(resTask.resourceType) >= reserved))){
                        creep.pickup(drops[0])
                    }
                }
            }


            if(oldState != state){
                let signs={
                    [IDLE]:    '💤',
                    [PICKUP]:  '📤',
                    [DROPOFF]: '📥'
                }
                let words = helper.getSay({symbol:signs[state]});
                creep.say(words.join(''))
            }

        });
        return isIdle;
    }
};

//#region Task Prototype
//#endregion
function Task(type, resourceType, targetID, amount, priority) {
    this.taskID = generateTaskID();
    this.type = type;
    this.resourceType = resourceType;
    this.targetID = targetID;
    this.amount = amount;
    this.priority = priority || 1;
    this.assignedHaulers = {};
}

Task.prototype.assignTo = function(hauler,amount='default') {
    //Assign default amount of as much as possible unless an amount is specified
    if(this.type == 'dropoff'){
        this.assignedHaulers[hauler.id] = amount == 'default' ? Math.min(hauler.store.getUsedCapacity(this.resourceType),this.unassignedAmount()) : amount;
    }
    else{
        this.assignedHaulers[hauler.id] = amount == 'default' ? Math.min(hauler.store.getFreeCapacity(),this.unassignedAmount()) : amount;
    }
    
    
    hauler.memory.task = this.taskID;
};

//Updates the amount requested on a task
Task.prototype.updateAmount = function(newAmount) {
    this.amount = newAmount;
    //Check to see if there are assigned haulers and if this is a pickup. If not, return.
    let assigned = Object.keys(this.assignedHaulers);
    if(!assigned.length || this.type == 'dropoff') return;

    //If there are, check each and update their assignments if possible.
    let remainingAmount = this.unassignedAmount();
    for(id of assigned) {
        let hauler = Game.getObjectById(id);
        //In case hauler is dead
        if(!hauler){
            delete this.assignedHaulers[id];
            continue;
        }
        let space = hauler.store.getFreeCapacity(this.resourceType);
        //If hauler's available space matches their assigned amount, return
        //At some point will need to adjust for multiple assigned tasks
        //hauler.getUnassignedSpace() - Would be a good prototype method
        console.log("Trying to increase amount of",this.resourceType,"from",this.assignedHaulers[id],". Hauler",id,"has",space,"space and is already assigned",this.assignedHaulers[id])
        if(space == this.assignedHaulers[id]) return;
        
        //Assign the remaining amount plus extra or the hauler's total space, whichever is less
        const assignAmount = Math.min(remainingAmount+this.assignedHaulers[id], space);
        console.log("Increasing to",assignAmount)
        this.assignedHaulers[id] = assignAmount;

        //Update remaining amount based on what we just assigned and break if zero
        remainingAmount -= assignAmount;
        if(remainingAmount == 0) break;
    }
};

Task.prototype.completeRun = function(hauler) {
    let runAmount = this.assignedHaulers[hauler.id]
    this.amount -= runAmount;
    if(this.isComplete()){
        console.log("Task",this.taskID,"complete! Removing!")
        this.remove(hauler.memory.fief);
        return;
    }
    delete this.assignedHaulers[hauler.id]
    delete hauler.memory.task;
};

Task.prototype.totalAssignedAmount = function() {
    return Object.values(this.assignedHaulers).reduce((sum, amount) => sum + amount, 0);
};

Task.prototype.unassignedAmount = function() {
    return this.amount - this.totalAssignedAmount();
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
    let newID = Game.time+global.heap.shipping.counter
    console.log("Generated task ID",newID)
    return newID;
}

function getTaskByID(fiefName, taskID) {
    if (global.heap.shipping[fiefName] && global.heap.shipping[fiefName].requests[taskID]) {
      return global.heap.shipping[fiefName].requests[taskID];
    }
    console.log("No task by that ID!",JSON.stringify(taskID))
    return null;
}

Task.prototype.remove = function(fiefName) {
    //Remove this task from all assigned haulers
    for(id in this.assignedHaulers){
        let hauler = Game.getObjectById(id);
        if(hauler){
            delete hauler.memory.task;
        }
        
    }
    //Delete self
    delete global.heap.shipping[fiefName].requests[this.taskID];
};

Task.prototype.unassign = function(hauler) {
    //Remove hauler from task
    if(this.assignedHaulers[hauler.id]) delete this.assignedHaulers[hauler.id];
    //Delete hauler task
    delete hauler.memory.task
};

module.exports = supplyDemand;
global.addSupplyRequest = supplyDemand.addRequest;

