const supplyDemand = {
    prepShipping: function(roomName){
        if (!global.heap) global.heap = {};
        if (!global.heap.shipping) global.heap.shipping = {};
        if (!global.heap.shipping[roomName]) global.heap.shipping[roomName] = [];
    },
    manageShipping: function(roomName,fiefCreeps){
        //Primary management function for a room to handle all supply/demand tasks
        //Run prepShipping for the room to ensure we're set up
        this.prepShipping(roomName);
        let room = Game.rooms[roomName];
        let terminal = room.terminal;
        let storage = room.storage;
        let poolHaulers = fiefCreeps.filter(creep => creep.memory.role == 'hauler')
        //No nuker because it takes so much energy. Only fill upon explicit request
        let fillStructures = [
            STRUCTURE_SPAWN,
            STRUCTURE_EXTENSION,
            STRUCTURE_LAB,
            STRUCTURE_POWER_SPAWN,
            STRUCTURE_TOWER
        ]

        //global.heap.shipping[roomName].forEach(task =>{
            //console.log(JSON.stringify(task));
        //})

        //Manage imports/exports

        //Process infrastructure energy demands (extensions,spawns,towers,labs)
        let energyStructures = [];
        //Only check every 5 ticks
        if(Game.time % 5 == 0){
            energyStructures = room.find(FIND_MY_STRUCTURES,{filter: 
                (structure) => fillStructures.includes(structure.structureType) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        }
        //If any need energy, set up tasks
        if(energyStructures.length){
            energyStructures.forEach(struct =>{
                let structNeed = struct.store.getFreeCapacity(RESOURCE_ENERGY);
                switch(struct.structureType){
                    //Towers get refilled below 700 in peacetime
                    case STRUCTURE_TOWER:
                        if(structNeed > 300){
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed
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
                                amount:structNeed
                            });
                        break;
                    case STRUCTURE_EXTENSION:
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed
                            });
                        break;
                }
            });

        };

        //Handle in-room haulers
        this.runHaulers(room,poolHaulers);
    },
    addRequest: function(room,details){
        supplyDemand.prepShipping(room.name);
        //Adds a request to the room's shipping tasks
        //Details is an object containing task data
        const DEFAULT_PRIORITY = 5;
        let shippingTasks = global.heap.shipping[room.name];
        let taskID = generateID();

        if(!(room instanceof Room)){
            if(Game.rooms[room]){
                room = Game.rooms[room]
            }
            else{
                console.log("ERR_NEED_ROOM_OBJECT")
                return -1;
            }
           
            
        }


        //Mandatory data. If missing, return error
        if(!details.type || !details.targetID || !details.amount){
            console.log("ERR_MISSING_DETAILS")
            return -1;

        }
        if(!details.resourceType) details.resourceType = RESOURCE_ENERGY
        //Check for an existing task for this target and type, return error if already there
        let existingTaskIndex = global.heap.shipping[room.name].findIndex(task =>
            task.targetID === details.targetID && task.type === details.type && task.resourceType === details.resourceType);
        if (existingTaskIndex !== -1){
            //console.log("ERR_EXISTING_TASK")
            //console.log(global.heap.shipping[room.name])
            return -1
        }
        let taskData = {
            id:taskID,
            type: details.type,
            targetID: details.targetID,
            amount: details.amount,
            resourceType: details.resourceType || RESOURCE_ENERGY
        }
        shippingTasks.push(taskData);
        return taskID; //Returning ID in case the requester wants it for something
    },
    removeTask: function(room,taskID){
        //Removes a request from the room's shipping tasks
        let shippingTasks = global.heap.shipping[room.name];
        const index = shippingTasks.findIndex(t => t.id === taskID);

        if (index !== -1) {
            shippingTasks.splice(index, 1);
        }
    },
    assignTask: function(creep,room){
        //Assigns a request to a creep based on capacity
        //Returns 0 if a task is found or -1 if not
        let shippingTasks = global.heap.shipping[room.name];
        let terminal = room.terminal;
        let storage = room.storage;
    
        // Get the creep's capacity
        let creepCapacity = creep.store.getCapacity();
        //Check if the creep is carrying anything
        let carriedResourceType = Object.keys(creep.store).find(resourceType => creep.store[resourceType] > 0);
        let assigned = false;
        //If they are carrying resources
        if (carriedResourceType) {
            // Attempt to find a 'demand' task that matches the resource type the creep is carrying
            let matchingTasks = shippingTasks.filter(task => task.type === 'dropoff' && task.resourceType === carriedResourceType);
    
            if (matchingTasks.length) {
                //Get closest task since we're dumping existing inventory
                let closestTask = null;
                let shortestRange = Infinity; // Start with a very high number

                matchingTasks.forEach(task => {
                    // Assuming task.targetID is the ID of the target structure
                    let target = Game.getObjectById(task.targetID);
                    if (target) {
                        let range = creep.pos.getRangeTo(target.pos);
                        if (range < shortestRange) {
                            shortestRange = range;
                            closestTask = task;
                        }
                    }
                });
                //Assign closest task
                creep.memory.task = { ...closestTask};
                assigned = true;
    
                // Adjust the task amount or remove it if fully handled
                let closestTaskIndex = shippingTasks.indexOf(closestTask);
                if (closestTask.amount <= creep.store[carriedResourceType]) {
                    shippingTasks.splice(closestTaskIndex, 1); // Task fully handled, remove it
                } else {
                    closestTask.amount -= creep.store[carriedResourceType];
                    //Dont forget to adjust the creep's amount
                    creep.memory.task.amount = creep.store[carriedResourceType]
                }
            }
        }
    
        // If no matching 'demand' task was found or the creep isn't carrying any resource, assign a task normally
        if (!assigned) {
            for (let i = 0; i < shippingTasks.length; i++) {
                let task = shippingTasks[i];
                //Check if it's a demand task. If so, verify we have the resoures in terminal/storage. If not, will have to wait til a supply task is completed for it
                if(task.type == 'dropoff'){
                    //If neither terminal nor storage can fulfill, pass on the task
                    if((!terminal || !terminal.store[task.resourceType] >= task.amount) && (!storage || !storage.store[task.resourceType] >= task.amount)){
                        console.log('No task assignment due to missing resource',task.resourceType)
                        continue;
                    }
                }
                //If it passed all checks, assign task
                //If task amount is greater than capacity
                if (task.amount > creepCapacity) {
                    creep.memory.task = { ...task }; // Assign the task to the creep
                    assigned = true;
                    //Reduce task amount by creep capacity, and set creep task amount to its capacity
                    task.amount -= creepCapacity;
                    creep.memory.task.amount = creepCapacity;
                    break;
                }
                //If the task is smaller or equal to capacity
                else if(task.amount <= creepCapacity){
                    //Need to handle multiple tasks at some point
                    creep.memory.task = { ...task };
                    assigned = true;
                    shippingTasks.splice(i, 1);
                    break;
                }
            }
        }
        // Return 0 for task, -1 for no task
        if (!creep.memory.task) {
            return -1;
        }else{
            return 0;
        }
    },
    //Haulers is an array of all hauler creeps in the room
    runHaulers: function(room,haulers) {
        const IDLE = 'idle';
        const PICKUP = 'pickup';
        const DROPOFF = 'dropoff';
        const RENEW = 'renew';
        const STATES = [IDLE,PICKUP,DROPOFF,RENEW];

        haulers.forEach(creep => {
            let state = creep.memory.state;
            //If the creep's state is not in the list of hauler states, skip.
            //Unfamiliar state means logic is taken over by another handler, likely combat
            if(creep.spawning) return;
            if(state && !STATES.includes(state)){
                return;
            };
            //If no state, or no task but a non-idle state, assign idle
            if(!state || (!creep.memory.task && creep.memory.state != IDLE)){
                state = IDLE;
                creep.memory.state = IDLE;
            }
            
            //console.log("Hauler",creep.name,'task:',JSON.stringify(creep.memory.task),'state:',creep.memory.state)
            if(state == IDLE){
                let work = this.assignTask(creep,room);
                //console.log("Work result:",work)
                //If we got a task, change state. If not, idle.
                if(work == 0){
                    //Got a task
                    let newTask = creep.memory.task;
                    let resourceType = newTask.resourceType
                    //console.log("New task type",newTask.type)
                    //If demand task
                    if(newTask.type == 'dropoff'){
                        //Are we carrying enough of what we need
                        if(creep.store.getUsedCapacity(resourceType) >= newTask.amount){
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
                        if(creep.store.getFreeCapacity() > newTask.amount){
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
                else if(work == -1){
                    //No task
                    //Increment idle counter when we get one

                    //If creep has stuff, dump it
                    if(creep.store.getUsedCapacity() > 0){
                        creep.emptyStore();
                    }
                }
            }

            if(state == PICKUP){
                let task = creep.memory.task;
                //Are we on a pickup task? If so, head to the target and take the resource
                if(task.type == 'pickup'){
                    let pickTarget = Game.getObjectById(task.targetID);
                    
                    if(creep.pos.getRangeTo(pickTarget) > 1){
                        creep.travelTo(pickTarget)
                    }
                    else{
                        //If we're in range, withdraw and finish the task
                        let x = creep.withdraw(pickTarget,task.resourceType);
                        //console.log(x)
                        delete creep.memory.task;
                        creep.memory.state = IDLE;
                    }
                }
                else if(task.type == 'dropoff'){
                    let resourceType = task.resourceType;
                    //Quick check to see if we're on the right track
                    //If we're picking up for a demand task, see if we have enough
                    if(creep.store[task.resourceType] >= task.amount){
                        //If so, set dropoff
                        creep.memory.state = DROPOFF
                    }
                    else{
                        //If not, dump and get it from terminal/storage, whichever has more
                        //If pulling energy, no amount specified so we multi-fill
                        let amountPick = resourceType == RESOURCE_ENERGY ? null : task.amount;
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
                            console.log(creep.name,"unable to complete task! No pickup location for",task.resourceType);
                            delete creep.memory.task;
                            creep.memory.state = IDLE;
                            return;
                        }
                    }
                }
                
            }
            else if(state == DROPOFF){
                let task = creep.memory.task;
                //Are we on a dropoff task? If so, go to target and transfer
                if(task.type == 'dropoff'){
                    let dropTarget = Game.getObjectById(task.targetID);
                    if(creep.pos.getRangeTo(dropTarget) > 1){
                        creep.travelTo(dropTarget)
                    }
                    else{
                        //If we're in range, transfer and finish the task
                        creep.transfer(dropTarget,task.resourceType);
                        delete creep.memory.task;
                        creep.memory.state = IDLE;
                        return;
                    }
                }
                else if(task.type == 'pickup'){
                    //If we're dumping cargo for a pickup task, see if we have space yet
                    if(creep.store.getFreeCapacity() >= task.amount){
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
                            delete creep.memory.task;
                            creep.memory.state = IDLE;
                        }
                    }
                }
            }
            else if(state == RENEW){
                //Dunno what this will do yet
            }
            

        });

    }
};

function generateID(){
    if(!global.heap.shipping.counterTick || global.heap.shipping.counterTick != Game.time){
        global.heap.shipping.counterTick = Game.time;
        global.heap.shipping.counter = 0
    }
    global.heap.shipping.counter += 1;
    return Game.time+global.heap.shipping.counter
}

module.exports = supplyDemand;
global.addSupplyRequest = supplyDemand.addRequest;
