const helper = require('functions.helper');
const registry = require('registry');
const profiler = require('screeps-profiler');
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
        let poolHaulers = fiefCreeps;
        //No nuker because it takes so much energy. Only fill upon explicit request
        let fillStructures = [
            STRUCTURE_SPAWN,
            STRUCTURE_EXTENSION,
            STRUCTURE_LAB,
            STRUCTURE_POWER_SPAWN,
            STRUCTURE_TOWER
        ]
        const MAX_IDLE = 0.15;

        //global.heap.shipping[roomName].forEach(task =>{
            //console.log(JSON.stringify(task));
        //})

        //Manage imports/exports


        
        //Process infrastructure energy demands (extensions,spawns,towers,labs)
        let energyStructures = [];
        energyStructures = room.find(FIND_MY_STRUCTURES,{filter: 
            (structure) => fillStructures.includes(structure.structureType) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });




        if(energyStructures.length){
            //Flag so we only request one refill mission
            let refillDone = false;
            energyStructures.forEach(struct =>{
                let structNeed = struct.store.getFreeCapacity(RESOURCE_ENERGY);
                //console.log("Structure need for",struct.structureType,"is",struct.store.getFreeCapacity(RESOURCE_ENERGY))
                switch(struct.structureType){
                    
                    //Towers get refilled below 700 in peacetime
                    //Don't refill til we're leaving or soon to be out of safemode
                    //This needs to be taken over by the military manager at some point
                    case STRUCTURE_TOWER:
                        if(structNeed > 300 && (!room.controller.safeMode || room.controller.safeMode < 100)){
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
                        if((struct.name && struct.name == 'Origin Keep') || ((!room.storage || room.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) && (!room.terminal || room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) == 0))){
                            this.addRequest(room,{
                                type:'dropoff',
                                targetID:struct.id,
                                amount:structNeed,
                                priority:9
                            });
                        }
                        else if(!refillDone){
                            this.addRequest(room,{
                                type:'refill',
                                priority:9,
                                targetID:room.controller.id,
                                amount:Infinity
                            });
                            refillDone = true;
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
                }
            });

        };
        //Handle in-room haulers, get idle count in return
        if(poolHaulers && poolHaulers.length){
            this.assignTasks(poolHaulers,room)
            let [idleCount,totalCount,postIdles] = this.runHaulers(room,poolHaulers,fiefCreeps);
            this.assignTasks(postIdles,room)
            
            //console.log("Idle count",idleCount)
            global.heap.shipping[roomName].utilization.unshift(idleCount/totalCount)

            //If utilization is past our tracking length, trim
            if(global.heap.shipping[roomName].utilization.length > MAX_SHIPPING_UTILIZATION) global.heap.shipping[roomName].utilization.length = MAX_SHIPPING_UTILIZATION;
        }
        //If no haulers, utilization is set to 0 by default
        else{
            global.heap.shipping[roomName].utilization.unshift(0)
        }
        if(Game.time % 3 == 0){
        
        //Calculate utilization and request more haulers if needed
            let utilization = global.heap.shipping[roomName].utilization.reduce((sum,util) => sum+util,0) / global.heap.shipping[roomName].utilization.length
            //Utilization minimum gets increased based on active remote demand vs hauler carry
            let totalCarry = poolHaulers.reduce((sum,current) => sum+current.store.getCapacity(),0)
            utilization = Math.min(utilization,totalCarry/((heap.fiefs[roomName].holdingDist || 0)*20))
            console.log('\nMAX_IDLE:',MAX_IDLE,'\nholdingDist:',heap.fiefs[roomName].holdingDist,'\nCalculated idle from history:',global.heap.shipping[roomName].utilization.reduce((sum,util) => sum+util,0) / global.heap.shipping[roomName].utilization.length,'\nLast tick idle',global.heap.shipping[roomName].utilization[0],'\nMinimum idle from holdings:',totalCarry/((heap.fiefs[roomName].holdingDist || 0)*20),'\nResult:',utilization)
            //Extra check, no spawning if half or more haulers are currently idle
            if(MAX_IDLE > utilization && global.heap.shipping[roomName].utilization[0] < 0.5){
                registry.requestCreep({sev:poolHaulers.length > 2 ? 35 : room.storage && room.storage.store[RESOURCE_ENERGY] > 100 ? 100 :  fiefCreeps.length > 2 ? 50 : 60,memory:{role:'hauler',fief:roomName,preflight:false,state:'idle'}})
            }
            //console.log(`${roomName} hauler utilization: ${utilization}`)
        }
        
        //console.log(global.heap.shipping[roomName].utilization)
    },
    addRequest: function(room,details){
        //addSupplyRequest(Game.rooms.E46N37,{type:'pickup',resourceType:'energy',amount:0,targetID:'aaa',international:true,priority:5})
       
        //console.log("Shipping ready!")
        //Adds a request to the room's shipping tasks
        //Details is an object containing task data
        const DEFAULT_PRIORITY = 1;
        //console.log("Add room",room.name)

        if (!(room instanceof Room)) {
            console.log("ERR_NEED_ROOM_OBJECT");
            return -1;
        }

        //If it isn't a fief, assign the homefief if it's a holding, otherwise the closest one
        if(!Memory.kingdom.fiefs[room.name]){
            if(Memory.kingdom.holdings[room.name]){
                room = Game.rooms[Memory.kingdom.holdings[room.name].homeFief];
            }
            else{
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
        for (let taskID in shippingTasks) {
            let task = shippingTasks[taskID];
            //Refill task logic
            if(details.type == 'refill'){
                if(task.type === 'refill'){
                    if(details.priority && details.priority > task.priority){
                        //console.log("Updated priority")
                        task.priority = details.priority;
                    }
                    else if(!details.priority){
                        details.priority = DEFAULT_PRIORITY;
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
        }
        //If no match, set up new task.
        let newTask = new Task(details.type,details.resourceType,details.targetID,details.amount,details.priority,details.international);
        shippingTasks[newTask.taskID] = newTask

        return newTask.taskID; //Returning ID in case the requester wants it for something
    },
    assignTasks: function(allHaulers,room){
        //See if we need 1 or 2 refillers, and fetch any current ones
        /*let needRefill = room.energyAvailable < room.energyCapacityAvailable
        let refillsNeeded = room.energyAvailable / room.energyCapacityAvailable > 0.5 ? 1 : 2
        let refillers = heap.fiefs[room.name].refillers && heap.fiefs[room.name].refillers.map(crp=> Game.getObjectById(crp)).filter(crp => !!crp && crp.ticksToLive > 100) || []
        if(needRefill) console.log(room.name,'needs refills. Refillers:',refillers,refillers.map(crp => crp.pos))
        if(!needRefill && refillers.length){
            for(let each of refillers){
                each.memory.state = 'idle';
            }
        }
        allHaulers = allHaulers.filter(crp => crp.memory.state != 'refill')*/

        let shippingTasks = heap.shipping[room.name].requests;
        //Every 5 ticks, check assigned haulers to see if we need to clear them out.
        if(Game.time % 5 == 0){
            for (let task of Object.values(shippingTasks)) {
                for (let crpID of Object.keys(task.assignedHaulers)) {
                    if (!Game.getObjectById(crpID) || !Game.getObjectById(crpID).memory.task || Game.getObjectById(crpID).memory.task != task.taskID) {
                        delete task.assignedHaulers[crpID];
                    }
                }
            }
        }
        
        let unassignedTasks = Object.values(shippingTasks).filter(task => task.unassignedAmount() > 0);

        //Categorize haulers
        //Split off specifically the idle haulers for now
        let idleHaulers = allHaulers.filter(h => h.memory.state == "idle");

        //If no unassigned tasks or free haulers, return
        if(!Object.keys(unassignedTasks).length || !idleHaulers.length) return;

        let emptyHaulers = [];
        let haulersByResource = {};
        let terminal = room.terminal;
        let storage = room.storage;
        let storagePos = storage ? storage.pos : Memory.kingdom.fiefs[room.name].roomPlan ? new RoomPosition(Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE][0].x,Memory.kingdom.fiefs[room.name].roomPlan[4][STRUCTURE_STORAGE][0].y,room.name) : new RoomPosition(25,25,room.name)
        
        //If no idle haulers then return
        if(!idleHaulers.length) return;
        //Split up empty and non-empty haulers
        for (let hauler of idleHaulers) {
            let usedCapacity = hauler.store.getUsedCapacity();
            if (usedCapacity === 0) {
                emptyHaulers.push(hauler);
            } else {
                let resType = Object.keys(hauler.store)[0];
                if (!haulersByResource[resType]) haulersByResource[resType] = [];
                haulersByResource[resType].push(hauler);
            }
        }

        //Prioritize
        //unassignedTasks.sort((a, b) => b.priority - a.priority);
        unassignedTasks.sort((a, b) => {
            // First, compare by priority
            let priorityDifference = b.priority - a.priority;
            
            // If priorities are equal, compare by unassignedAmount
            if (priorityDifference === 0) {
                return b.unassignedAmount() - a.unassignedAmount();
            }
            
            // Otherwise, return the priority difference
            return priorityDifference;
        });
        //Loop through tasks and assign where possible
        for (let task of unassignedTasks) {
            if(heap.wardens && heap.wardens[room.name] && task.international)continue
            let taskTarget = Game.getObjectById(task.targetID);
            if (!taskTarget || !task.amount) {
                task.remove(room.name);
                continue;
            }
            else if(global.heap.alarms[Game.getObjectById(task.targetID).room.name]){
                continue;
            }

            let assigned = false;
            // Handdle refill tasks
            if (task.type === 'refill'){
                assigned = assignRefill(task, haulersByResource, emptyHaulers);
            }
            // Handle dropoff tasks
            if (!assigned && task.type === 'dropoff') {
                assigned = assignDropoff(task, taskTarget, haulersByResource, emptyHaulers, terminal, storage);
            }
    
            // Handle pickup tasks
            if (!assigned && task.type === 'pickup' && emptyHaulers.length) {
                //Keep assigning haulers til we can't
                /*do{
                    assigned=false;

                    let thisvar = assignPickup(task, taskTarget, emptyHaulers);
                    if(thisvar[0] && thisvar[0] == true) assigned=true;
                    if(thisvar[1] && thisvar[1] instanceof Creep) emptyHaulers = emptyHaulers.filter(h => h.id !== thisvar[1].id);

                }while(assigned==true && task.unassignedAmount()>0)*/
                //Attempting to fix many haulers assigning to dropped resources. Now only assign one hauler per task per tick
                let thisvar = assignPickup(task, taskTarget, emptyHaulers);
                if(thisvar[0] && thisvar[0] == true) assigned=true;
                if(thisvar[1] && thisvar[1] instanceof Creep) emptyHaulers = emptyHaulers.filter(h => h.id !== thisvar[1].id);
            }
        }

        function assignRefill(task, haulersByResource, emptyHaulers) {
            let current = Object.keys(task.assignedHaulers).length;
            let totalStore = Object.values(task.assignedHaulers || {}).reduce((sum, value) => sum + value, 0);
            let refillAmount = room.energyCapacityAvailable - room.energyAvailable;
            //No more than 3 assigned to refill and stores only need to be 50% of the energy gap
            if(current >=3 || totalStore/refillAmount > 0.5){
                //Since we don't need more, check instead if we should replace based on distance
                let refillers = Object.keys(task.assignedHaulers).map(id => Game.getObjectById(id)).filter(crp => !!crp)
                let furthestRefiller = {creep:null,range:0}
                for(let each of refillers){
                    let dist = getTileDistance(storagePos,each.pos);
                    if(dist > furthestRefiller.range){
                        furthestRefiller.creep = each;
                        furthestRefiller.range = dist;
                    }
                }
                if(furthestRefiller.range <= 25) return [false,null];
                let energyPick = storagePos.getClosestByTileDistance(haulersByResource[task.resourceType] || []);
                let emptyPick = storagePos.getClosestByTileDistance(emptyHaulers || []);
                let finalPick = !!energyPick && !! emptyPick ? storagePos.getClosestByTileDistance([energyPick,emptyPick]) : energyPick || emptyPick
                if(finalPick && getTileDistance(storagePos,finalPick.pos) <= furthestRefiller.range/2){
                    task.unassign(furthestRefiller.creep,'Closer refiller found');
                    task.assignTo(finalPick);
                    if(emptyHaulers) emptyHaulers = emptyHaulers.filter(h => h.id !== finalPick.id);
                    if(haulersByResource[task.resourceType]) haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== finalPick.id);
                    return [true,finalPick]
                }
                return [false,null];
            }
            //Get closest of all haulers to assign
            let energyPick = storagePos.getClosestByTileDistance(haulersByResource[task.resourceType] || []);
            let emptyPick = storagePos.getClosestByTileDistance(emptyHaulers || []);
            let finalPick = !!energyPick && !! emptyPick ? storagePos.getClosestByTileDistance([energyPick,emptyPick]) : energyPick || emptyPick
            if(finalPick){
                task.assignTo(finalPick);
                if(emptyHaulers) emptyHaulers = emptyHaulers.filter(h => h.id !== finalPick.id);
                if(haulersByResource[task.resourceType]) haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== finalPick.id);
                return [true,finalPick]
            }
            return [true,finalPick]
        }

        function assignDropoff(task, taskTarget, haulersByResource, emptyHaulers, terminal, storage) {
            if (haulersByResource[task.resourceType]) {
                let eligibles = haulersByResource[task.resourceType].filter(hauler => hauler.store.getUsedCapacity(task.resourceType) > 0);
                if (eligibles.length) {
                    let hauler = taskTarget.pos.getClosestByTileDistance(eligibles);
                    task.assignTo(hauler);
                    haulersByResource[task.resourceType] = haulersByResource[task.resourceType].filter(h => h.id !== hauler.id);
                    return true;
                }
            }
        
            //If no resource hauler, check terminal/storage for backup resources to see if we can fill
            if ((terminal && terminal.store[task.resourceType] > 0) ||
                (storage && storage.store[task.resourceType] > 0)) {
                //If we have empty haulers, assign the closest
                if (emptyHaulers.length > 0) {
                    let hauler = taskTarget.pos.getClosestByTileDistance(emptyHaulers);

                    task.assignTo(hauler,Math.min(hauler.store.getCapacity(),task.amount));
                    emptyHaulers = emptyHaulers.filter(h => h.id !== hauler.id);
                    return true;
                }
            }
            return false;
        }
        
        function assignPickup (task, taskTarget, emptyHaulers) {
            if(!emptyHaulers.length) return [false,null];
            let nearestHauler = taskTarget.pos.getClosestByTileDistance(emptyHaulers);
            
            if (nearestHauler.ticksToLive < (getTileDistance(nearestHauler.pos,taskTarget.pos)*2)*1.3) return [false,null]
            if (task.resourceType === RESOURCE_ENERGY && (!taskTarget.store || (taskTarget.structureType && taskTarget.structureType == STRUCTURE_CONTAINER))) {
                let decayCalcAmount = 9 //Default 5x harv, losing 1 per tick for 9 total
                //Special handling for dropped energy
                //If task is international, and we don't have the room reserved, reduce decay calc amount to 5 for the typical 3x harv
                if(task.international && (!taskTarget.room.controller || !taskTarget.room.controller.reservation || taskTarget.room.controller.reservation.username != Memory.me)){
                    decayCalcAmount = 5
                }
                let calcAmount = task.unassignedAmount() + (getTileDistance(nearestHauler.pos,taskTarget.pos) * decayCalcAmount);
                if (calcAmount >= nearestHauler.store.getFreeCapacity(RESOURCE_ENERGY)) {
                    task.assignTo(nearestHauler,nearestHauler.store.getFreeCapacity(RESOURCE_ENERGY));

                    return [true,nearestHauler];
                }
                else{
                    return [false,null]
                }
            } else {
                //Standard pickup
                 {
                    task.assignTo(nearestHauler);
                    return [true,nearestHauler];
                }

            }
        
            return [false,null];
        }
    },
    //Haulers is an array of all hauler creeps in the room
    runHaulers: function(room,haulers,fiefCreeps) {
        const IDLE = 'idle';
        const PICKUP = 'pickup';
        const DROPOFF = 'dropoff';
        const RENEW = 'renew';
        const TOW = 'tow';
        const REFILL = 'refill';
        const STATES = [IDLE,PICKUP,DROPOFF,RENEW,TOW,REFILL];
        let shippingTasks = global.heap.shipping[room.name].requests;
        let isIdle = 0;
        let totalCarry = 0;
        let combos = [];
        let [emptyHauls,energyHauls] = haulers.reduce((arr,hauler) => {
            if(hauler.store[RESOURCE_ENERGY]) arr[1].push(hauler);
            //Pushing to empty haulers goes here
            //Need solid logic to only push on dropoffs (probably?) where they won't run into trouble
            return arr
        },[[],[]]);
        let postIdles = [];

        //If a hauler is next to an empty spawn/extension, fill
        //Also get upgraders and builders

        let coreLink = Memory.kingdom.fiefs[room.name].links && Memory.kingdom.fiefs[room.name].links.coreLink
        let remoteLinks = Memory.kingdom.fiefs[room.name].links && Memory.kingdom.fiefs[room.name].links.remoteLinks
        let link = Game.getObjectById(coreLink)
        //Track IDs of fills so we can clear their tasks
        let fillTransfers = []
        for(let haul of energyHauls){
            //if(link && haul.store.getFreeCapacity()>0){
                //haul.withdraw(link,RESOURCE_ENERGY)
            //}
            //All energy haulers pull from the core link
            if(link && link.store[RESOURCE_ENERGY] > 0 && link.pos.isNearTo(haul.pos) && haul.store.getFreeCapacity()>0){
                haul.withdraw(link,RESOURCE_ENERGY)
            }
            //None refill haulers fill remote links
            if(haul.memory.state != 'refill' && remoteLinks){
                for(let lk of remoteLinks){
                    let lkg = Game.getObjectById(lk)
                    let lRange = haul.pos.getRangeTo(lkg);
                    if(lkg && (lkg.store[RESOURCE_ENERGY] < 800 || (link && link.store[RESOURCE_ENERGY] < 800 && lkg.cooldown < 5)) && !lkg.reserved && lRange < 5){
    
                        if(lRange == 1 && !lkg.cooldown){
                            haul.transfer(lkg,RESOURCE_ENERGY)
                            if(haul.store[RESOURCE_ENERGY] > lkg.store.getFreeCapacity()){
                                haul.state = "waiting"
                                lkg.reserved = true;
                            }
                            else{
                                haul.state = "idle"
                                lkg.reserved = true;
                                if(haul.memory.task)getTaskByID(haul.memory.fief,haul.memory.task).unassign(haul,'RemoteLink dump')
    
                            }
                        }
                        else{
                            if(lRange > 1) haul.travelTo(lkg);
                            haul.state = "waiting"
                            lkg.reserved = true;
                        }
                    }
                }
            }

            //All haulers check to see if they can ad hoc fill
            let checkPos = `${haul.pos.x},${haul.pos.y}`
            if(heap.fiefs[room.name].sourceRefills && heap.fiefs[room.name].sourceRefills.has(checkPos)){
                let fillTargets = heap.fiefs[room.name].sourceRefills.get(checkPos);
                let target = Game.getObjectById(fillTargets.values().next().value);
                haul.transfer(target,RESOURCE_ENERGY);
                fillTransfers.push(target.id);
                continue
            }
            else if(heap.fiefs[room.name].otherRefills && heap.fiefs[room.name].otherRefills.has(checkPos)){
                let fillTargets = heap.fiefs[room.name].otherRefills.get(checkPos);
                let target = Game.getObjectById(fillTargets.values().next().value);
                haul.transfer(target,RESOURCE_ENERGY);
                fillTransfers.push(target.id);
                continue
            }
            //Non refill haulers ad hoc fill builders/ugraders
            let buildUps = haul.room.find(FIND_MY_CREEPS).filter(c=>(c.memory.role == 'upgrader' || c.memory.role == 'builder') && c.store.getFreeCapacity()>c.store.getCapacity()/2)
            for(let targetCrp of buildUps){
                if(haul.memory.state != 'refill' && haul.pos.isNearTo(targetCrp)){
                    haul.transfer(targetCrp,RESOURCE_ENERGY);
                    break;
                }
            }
        }
        let fillTasks = []
        for(let each of Object.values(shippingTasks)){
            if(fillTransfers.includes(each.taskID)){
                fillTasks.push(each)
            }
        }
        for(let every of fillTasks){
            every.remove(room.name)
        }

        //Hauler action loop
        haulers.forEach(creep => {
            let postFlag = true;
            let carryParts = creep.getActiveBodyparts(CARRY);
            //Add carry parts so we can track idle time
            totalCarry += carryParts;
            
            if(global.heap.alarms[creep.room.name]){
                let baddies = creep.room.find(FIND_HOSTILE_CREEPS).filter(c=>!helper.isSoldier(c) && !isFriend(c))
                let bad = creep.pos.findClosestByRange(baddies)
                if(bad && creep.pos.getRangeTo(bad) < 7){
                    if(creep.memory.task) getTaskByID(creep.memory.fief,creep.memory.task).unassign(creep,'Fleeing')
                        let words = helper.getSay({symbol:`${Game.time % 2 == 1 ? '🚨' : '📢'}`});
                        creep.say(words.join(''))
                        creep.memory.status = 'flee';
                        creep.travelTo(Game.rooms[creep.memory.fief].controller,{range:10})
                }

            }
            else if(creep.memory.status == 'flee'){
                if([0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                    creep.travelTo(Game.rooms[creep.memory.fief].controller,{range:10});
                }

                creep.memory.status = 'idle'
            }
            //Deathcheck every 3 ticks to match spawn timing
            if(Game.time % 3 == 0 && creep.ticksToLive <= CREEP_SPAWN_TIME*creep.body.length && !creep.memory.respawn){
                let utilization = global.heap.shipping[room.name].utilization.reduce((sum,util) => sum+util,1) / global.heap.shipping[room.name].utilization.length
                
                //Check utilization to make sure we aren't respawning when not needed
                if(utilization < 0.15){
                    registry.requestCreep({sev:35,memory:{role:'hauler',fief:room.name,preflight:false},respawn:creep.id})
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
                //console.log("Checktask for",creep.name,"task ID",creep.memory.task)
                if(!checkTask){
                    delete creep.memory.task
                }
                else if(checkTask.type != 'refill' && checkTask.assignedHaulers[creep.id] <= 0 || checkTask.assignedHaulers[creep.id] == null){
                    //console.log(Game.time)
                   // console.log("Task ID",creep.memory.task,"in room",creep.memory.fief,"unassigning due to assigned inventory:",checkTask.assignedHaulers[creep.id],"in task",JSON.stringify(checkTask))
                    checkTask.unassign(creep,checkTask.assignedHaulers[creep.id] <= 0 ? "Assigned amount is <=0." : "No result for this creep in assigned haulers") 
                }
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
                    //console.log(creep.name,"new task!")
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
                    else if(newTask.type == 'refill'){
                        creep.memory.state = REFILL;
                        state = REFILL;
                    }
                }
                else{
                    //No task
                    //Increment idle counter when we get one
                    //If we started idle then we don't need to be added to postIdles
                    postFlag = false;
                    //If creep has stuff, dump it
                    if(creep.store.getUsedCapacity() > 0){
                        creep.emptyStore();
                    }
                    //If chilling idle, go home if remote. If home then stay off room edges
                    else if(creep.room.name != creep.memory.fief || [0,1,48,49].includes(creep.pos.x) || [0,1,48,49].includes(creep.pos.y)){
                        creep.travelTo(Game.rooms[creep.memory.fief].controller,{range:10,maxRooms:32});
                    }
                }
            }
            if(state == REFILL){
                creep.say('⚡')
                let refillTask = getTaskByID(creep.memory.fief,creep.memory.task);
                console.log(creep,room.name,'ENERGY EVEN',room.energyAvailable == room.energyCapacityAvailable)
                if(room.energyAvailable == room.energyCapacityAvailable || ((!room.storage || room.storage.store.getUsedCapacity(RESOURCE_ENERGY) == 0) && (!room.terminal || room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) == 0))){
                    refillTask.remove(creep.memory.fief)
                    creep.memory.state = IDLE;
                    state = IDLE;
                }
                //If we're empty, go fill up
                else if(creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0){
                    console.log(creep,"getting energy for refill",creep.pos)
                    let roomStore = room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                    let roomTerm = room.terminal && room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
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
                    if(creep.pos.getRangeTo(roomTarget) > 1){
                        creep.travelTo(roomTarget);
                    }
                    else{
                        //If we have other resources, dump one, withdraw energy
                        if(Object.keys(creep.store).length) creep.transfer(roomTarget,Object.keys(creep.store)[0])
                        creep.withdraw(roomTarget,RESOURCE_ENERGY);
                    }
                }
                //If we have energy, go start dropping it off
                else{
                    let sourceMap = heap.fiefs[room.name].sourceRefills;
                    let otherMap = heap.fiefs[room.name].otherRefills;
                    //If we already have a target
                    if(creep.memory.refillTarget){
                        if(!otherMap.has(creep.memory.refillTarget) && !sourceMap.has(creep.memory.refillTarget)){
                            delete creep.memory.refillTarget;
                            if(otherMap && otherMap.size) {
                                console.log(creep, "getting othermap");
                                creep.memory.refillTarget = getRefillTarget(creep, otherMap, room.name);
                            }
                            else if(sourceMap && sourceMap.size) {
                                console.log(creep, "getting sourcemap");
                                creep.memory.refillTarget = getRefillTarget(creep, sourceMap, room.name);
                            }
                            else{
                                refillTask.remove(creep.memory.fief)
                                creep.memory.state = IDLE;
                                state = IDLE;
                                return;
                            }
                        }
                        let [x, y] = creep.memory.refillTarget.split(',').map(num => parseInt(num));
                        let targetPos = new RoomPosition(x, y, room.name);
                        console.log(creep,"refilling",targetPos,'total refills',sourceMap.has(creep.memory.refillTarget) ? sourceMap.get(creep.memory.refillTarget).size : otherMap.has(creep.memory.refillTarget) ? otherMap.get(creep.memory.refillTarget).size : 'No map has target')
                        if(creep.pos.getRangeTo(targetPos) > 0){
                            creep.travelTo(targetPos);
                        }
                        else{
                            let refillExt;
                            if(otherMap.has(creep.memory.refillTarget)){
                                refillExt = Game.getObjectById(otherMap.get(creep.memory.refillTarget).values().next().value);
                                creep.transfer(refillExt,RESOURCE_ENERGY)
                            }
                            else if(sourceMap.has(creep.memory.refillTarget)){
                                refillExt = Game.getObjectById(sourceMap.get(creep.memory.refillTarget).values().next().value);
                                creep.transfer(refillExt,RESOURCE_ENERGY)
                            }
                        }
                    }
                    //If we need to get a target
                    else if(otherMap && otherMap.size) {
                        console.log(creep, "getting othermap");
                        creep.memory.refillTarget = getRefillTarget(creep, otherMap, room.name);
                    }
                    else if(sourceMap && sourceMap.size) {
                        console.log(creep, "getting sourcemap");
                        creep.memory.refillTarget = getRefillTarget(creep, sourceMap, room.name);
                    }
                }
                return;
            }
            if(state == TOW){

            }

            if(state == PICKUP){
                let task = getTaskByID(creep.memory.fief,creep.memory.task);
                if(task == null){
                    delete creep.memory.task;
                    return;
                }
                else if(task.assignedHaulers[creep.id] < 20 && task.resourceType == RESOURCE_ENERGY && Game.rooms[creep.memory.fief].controller.level > 2){
                    task.unassign(creep,"Assigned amount is low energy.")
                }
                //Are we on a pickup task? If so, head to the target and take the resource
                if(task.type == 'pickup'){
                    let pickTarget = Game.getObjectById(task.targetID);
                    if(!pickTarget || pickTarget == null){
                        //console.log("Bad pickuptarget",task.targetID)
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
                        if(pickTarget instanceof Creep){
                            pickTarget.transfer(creep,task.resourceType);
                        }
                        else{
                            let x = creep.withdraw(pickTarget,task.resourceType);
                        }
                        //If we're in range, withdraw and finish the task

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
                        //If no amount anywhere, drop task
                        if(((room.storage && room.storage.id != task.targetID && room.storage.store[resourceType])|| 0) + ((room.terminal && room.terminal.id != task.targetID && room.terminal.store[resourceType])|| 0) == 0){
                            task.unassign(creep,"No resources to get")
                        }
                        if(Memory.kingdom.fiefs[creep.room.name] && creep.room.storage && creep.room.terminal){
                            //Take from storage if it has more and is not the target, or if our target is the terminal
                            if((creep.room.storage.store.getUsedCapacity(resourceType) >= creep.room.terminal.store.getUsedCapacity(resourceType) && creep.room.storage.id != task.targetID) || task.targetID == creep.room.terminal.id){
                                //dumpAndGet() dumps extra materials and gets up to an amount of resource
                                creep.dumpAndGet(creep.room.storage,resourceType);
                                //console.log("C1")
                            }else{
                                creep.dumpAndGet(creep.room.terminal,resourceType);
                                //console.log("C2")
                            }
                        }
                        else if(Memory.kingdom.fiefs[creep.room.name] && creep.room.storage){
                            creep.dumpAndGet(creep.room.storage,resourceType);
                            //console.log("C3")
                        }
                        else if(Memory.kingdom.fiefs[creep.room.name] && creep.room.terminal){
                            creep.dumpAndGet(creep.room.terminal,resourceType);
                            //console.log("C4")
                        }
                        else if(!Memory.kingdom.fiefs[creep.room.name] && (Game.rooms[creep.memory.fief].storage || Game.rooms[creep.memory.fief].terminal)){
                            if(Game.rooms[creep.memory.fief].terminal){
                                creep.travelTo(Game.rooms[creep.memory.fief].terminal,{maxRooms:32})
                                //console.log("C5")
                            }
                            else if(Game.rooms[creep.room.name].storage){
                                creep.travelTo(Game.rooms[creep.memory.fief].storage,{maxRooms:32})
                                //console.log("C6")
                            }
                        }
                        //If no storage or terminal, throw alert and kill task. Move to idle.
                        else{
                           // console.log(creep.name,"unable to complete task!",JSON.stringify(task)," No pickup location. Hauler has",creep.store[task.resourceType]);
                           console.log("C7")
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
                    //Make sure we didn't dump all our inventory. If so, pickup
                    if(creep.store.getUsedCapacity() == 0 && (!global.heap.relays || !global.heap.relays.includes(creep.id))){
                        task.unassign(creep,"Used capacity is zero");
                        return;
                    }
                    let dropTarget = Game.getObjectById(task.targetID);
                    if(creep.pos.getRangeTo(dropTarget) > 1){
                        creep.travelTo(dropTarget,{maxRooms:32})
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
                        if(Memory.kingdom.fiefs[creep.room.name] && (creep.room.storage || creep.room.terminal)){
                            creep.emptyStore();
                        }
                        if(!Memory.kingdom.fiefs[creep.room.name] && (Game.rooms[creep.memory.fief].storage || Game.rooms[creep.memory.fief].terminal)){
                            if(Game.rooms[creep.memory.fief].terminal){
                                creep.travelTo(Game.rooms[creep.memory.fief].terminal)
                            }
                            else if(Game.rooms[creep.memory.fief].storage){
                                creep.travelTo(Game.rooms[creep.memory.fief].storage)
                            }
                        }
                        //If no storage or terminal, throw alert and kill task. Move to idle.
                        else{
                           // console.log(creep.name,"unable to complete task! No storage/terminal for",task.resourceType);
                            task.remove(creep.memory.fief)
                            creep.memory.state = IDLE;
                        }
                    }
                }
            }
            else if(state == RENEW){
                //Dunno what this will do yet
            }
            let usedStore = creep.store.getUsedCapacity();
            //If state is idle, all idle
            if(state==IDLE){
                //See if we can be usefulby renewing
                isIdle += carryParts
                //No postflag means we didn't do anything, no need to rerun
                if(postFlag) postIdles.push(creep)
                

                if(creep.memory.fief == creep.room.name && creep.store.getUsedCapacity(RESOURCE_ENERGY) >0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity()){
                    combos.push(creep)
                }
                //Recycle if we have lots of haulers and we're low on life
                else if(creep.memory.fief == creep.room.name && creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0){
                    if(heap.shipping[creep.memory.fief].utilization[0] > 0.5 && creep.ticksToLive < 200){
                        let spawns = Memory.kingdom.fiefs[creep.memory.fief].spawns.map(spw => Game.getObjectById(spw)).filter(spw => !spw.spawning)
                        if(spawns.length){
                            let tSpawn = creep.pos.findClosestByRange(spawns)
                            if(creep.pos.getRangeTo(tSpawn) == 1){
                                tSpawn.recycleCreep(creep)
                            }
                            else{
                                creep.travelTo(tSpawn)
                            }
                        }
                    }
                }

            } else{
                //Check if we're empty, if so we need to use the assigned amount to calculate
                if(usedStore == 0){
                    let myTask = getTaskByID(creep.memory.fief,creep.memory.task);
                    if(myTask == null){
                        isIdle += carryParts
                    }else{
                        assignedQty = myTask.assignedHaulers[creep.id]
                        isIdle += (carryParts - Math.ceil(assignedQty / CARRY_CAPACITY))
                    }
                    
                }

                //If not empty, no idle
                else{
                    //isIdle += (carryParts - Math.ceil(usedStore / CARRY_CAPACITY))
                }
            }


            if(oldState != state){
                let signs={
                    [IDLE]:    '💤',
                    [PICKUP]:  '📤',
                    [DROPOFF]: '📥'
                }
                let words = signs[state] ? helper.getSay({symbol:signs[state]}) : '𒃽'
                creep.say(words.join(''))
            }

        });
        //Before we return, we try to combine energy
        if(combos.length){
            combos.sort((a,b) =>{
                let usedA = a.store.getUsedCapacity(RESOURCE_ENERGY);
                let usedB = b.store.getUsedCapacity(RESOURCE_ENERGY);

                return usedA-usedB;
            });
            //From most to least, have them move to combine with the next
            for(i=0;i<combos.length-1;i++){
                if(combos[i].pos.getRangeTo(combos[i+1]) == 1){
                    combos[i].transfer(combos[i+1],RESOURCE_ENERGY);
                }
                else{
                    combos[i].travelTo(combos[i+1])
                }
                combos[i].say('💱')
            }
        }
        return [isIdle,totalCarry,postIdles];
    }
};

//#region Task Prototype
//#endregion
function Task(type, resourceType, targetID, amount, priority,international,targetRoom,taskID,assignedHaulers,tick) {
    this.taskID = taskID || generateTaskID();
    this.type = type;
    this.resourceType = resourceType;
    this.targetID = targetID;
    this.targetRoom = targetRoom || Game.getObjectById(targetID).room.name
    this.amount = amount;
    this.priority = priority || 1; //Everything above priority 3 is considered for hauler population demand
    this.assignedHaulers = assignedHaulers || {};
    this.international = international || false;
    this.tick = tick || Game.time;
}

Task.prototype.assignTo = function(hauler,amount='default') {
    //Assign default amount of as much as possible unless an amount is specified
    if(this.type == 'dropoff'){
        this.assignedHaulers[hauler.id] = amount == 'default' ? Math.min(hauler.store.getUsedCapacity(this.resourceType),this.unassignedAmount()) : amount;
    }
    else if(this.type == 'refill'){
        this.assignedHaulers[hauler.id] = hauler.store.getCapacity();
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
        //console.log("Trying to increase amount of",this.resourceType,"from",this.assignedHaulers[id],". Hauler",id,"has",space,"space and is already assigned",this.assignedHaulers[id])
        if(space == this.assignedHaulers[id]) return;
        
        //Assign the remaining amount plus extra or the hauler's total space, whichever is less
        const assignAmount = Math.min(remainingAmount+this.assignedHaulers[id], space);
        //console.log("Increasing to",assignAmount)
        this.assignedHaulers[id] = assignAmount;

        //Update remaining amount based on what we just assigned and break if zero
        remainingAmount -= assignAmount;
        if(remainingAmount == 0) break;
    }
    //If we still have a remaining amount, and it's below 40, remove it from the total amount
    //if(remainingAmount > 0 && remainingAmount < 40){
        //this.amount -= remainingAmount;
    //}
};

Task.prototype.completeRun = function(hauler) {
    let runAmount = this.assignedHaulers[hauler.id]
    this.amount -= runAmount;
    if(this.isComplete()){
        //console.log("Task",this.taskID,"complete! Removing!")
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
    for(id in this.assignedHaulers){
        let hauler = Game.getObjectById(id);
        if(hauler){
            delete hauler.memory.task;
        }
        
    }
    //Delete self
    delete global.heap.shipping[fiefName].requests[this.taskID];
};

Task.prototype.unassign = function(hauler,reason) {
    if(!reason) reason = 'No reason.'
    //Remove hauler from task
    //console.log("Unassigning task",reason,JSON.stringify(this),"from hauler",hauler.name)
    if(this.assignedHaulers[hauler.id]) delete this.assignedHaulers[hauler.id];
    //Delete hauler task
    delete hauler.memory.task
};

function getRefillTarget(creep, map, roomName) {
    if (!map || map.size === 0) return null;
    
    let positions = [];
    for (let coordStr of map.keys()) {
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
profiler.registerObject(supplyDemand, 'supplyDemand');
profiler.registerClass(Task, 'Task');
module.exports = supplyDemand;
global.addSupplyRequest = supplyDemand.addRequest;