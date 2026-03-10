const profiler = require('screeps-profiler');
const granary = {
    GRAN_MAX: 12,
    //Calculates planned and trailing average energy income/expense for a room
    getIncome: function(fief){
        if(!global.heap.granary[fief] || !global.heap.granary[fief].length) return [0,0]
        let fiefList = global.heap.granary[fief];
        let plannedNet = fiefList[0].total
        let averageNet = +(fiefList.reduce((sum,item) => sum+item.total,0) / fiefList.length).toPrecision(2);

        //Check how long the list is and trim if below our max
        if(fiefList.length > this.GRAN_MAX) fiefList.length = this.GRAN_MAX

        return [plannedNet,averageNet]
    },
    //Registers income/expense for a room
    adjustIncome: function(source,amount){
        // -- To Add --
        //Repair
        //Upgrade
        //Spawn
        if(!global.heap.granary){
            return;
        }
        //If a room object, get its room name. Otherwise it's a creep, so get its fief.
        let fief = source instanceof Creep ? source.memory.fief : source.room.name;
        if(!global.heap.granary[fief]) global.heap.granary[fief] = []
        let track = global.heap.granary[fief];
        //Pulls track[0] if it's from this tick, otherwise makes a new one
        let thisTrack = track && track[0] && track[0].tick == Game.time && track.shift() || {tick:Game.time,total:0};

        //For now just track an integer for that tick, may want to get more granular down the road
        thisTrack.total += amount;

        //Pop it to the front of the queue
        track.unshift(thisTrack)
        

    },
    manageWares: function(){
        let kingdomWares = heap.kingdomStatus.wares;
        //Assign lab targets every 50 ticks
        if(Game.time % 20 == 0) this.manageLabs(kingdomWares)
        if(Game.time % 10 == 0) this.manageTerminalRequests();
    },
    manageTerminalRequests: function(){
        if(!heap.terminalRequests)return;
        for(const fief of Object.keys(Memory.kingdom.fiefs)){
            if(!heap.terminalRequests[fief])continue;
            let fiefRequests = heap.terminalRequests[fief];
            for(const resource of Object.keys(fiefRequests)){
                let request = fiefRequests[resource];
                let room = Game.rooms[fief];
                if(!room.terminal) continue;
                //Update termNeeds if it doesn't match
                if(!Memory.kingdom.fiefs[fief].termNeeds) Memory.kingdom.fiefs[fief].termNeeds = {};
                let termNeeds = Memory.kingdom.fiefs[fief].termNeeds;
                if(!termNeeds[resource] || termNeeds[resource] < request.amount){
                    termNeeds[resource] = request.amount;
                }
                //If we have enough, ship it, reduce the resource need, and remove the request
                else if(room.terminal.store.getUsedCapacity(resource) >= request.amount){
                    let targetTerminal = Game.rooms[request.targetFief].terminal;
                    //If no terminal or not enough space, continue;
                    if(!targetTerminal || targetTerminal.store.getFreeCapacity() < request.amount) continue;
                    let cost = Game.market.calcTransactionCost(request.amount,fief,request.targetFief);
                    //Request the energy if we can't afford to ship it
                    if(room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost){
                        Memory.kingdom.fiefs[fief].termNeeds.energy = (Memory.kingdom.fiefs[fief].termNeeds.energy || 0) + cost;
                        continue;
                    }
                    room.terminal.send(resource,request.amount,request.targetFief);
                    chronicle.log(`${fief} sending ${request.amount} ${resource} to ${request.targetFief} for ${cost} energy.`,'granary',3);
                    termNeeds[resource] -= request.amount;
                    delete fiefRequests[resource];
                }
            }
        }
    },
    manageLabs: function(kingdomWares){
        MAX_INGREDIENT_REQUEST = 10000;
        let [labTargets,validTargets] = getLabTargets(kingdomWares);
        console.log("LAB TARGETS",JSON.stringify(labTargets))
        for(const fiefName of Object.keys(Memory.kingdom.fiefs)){
            let targetResource;
            let fief = Memory.kingdom.fiefs[fiefName]
            //Skip if no labs or wares
            if(!fief.labs) continue;
            if(!heap.kingdomStatus.fiefs[fiefName].wares) continue;
            //If the lab already has a valid resource, then remove it from the options and process its target
            if(fief.labs.target && validTargets.includes(fief.labs.target)){
                targetResource = fief.labs.target;
                validTargets = validTargets.filter(r => r != targetResource);
            }
            else{
                for(const tier of Object.keys(labTargets)){
                    if(labTargets[tier] && labTargets[tier].length){
                        targetResource = labTargets[tier].pop();
                        fief.labs.target = targetResource;
                        chronicle.log(`${fiefName} lab target set to ${targetResource}`,'granary',3);
                        break;
                    }
                }
            }
            let ingredients = REACTION_INGREDIENTS[targetResource];
            let fiefWares = heap.kingdomStatus.fiefs[fiefName].wares;
            //Check if the fief needs ingredients to produce
            for(const each of ingredients){
                if(!fiefWares[each] || fiefWares[each] < MINIMUM_LAB_PRODUCTION_AMOUNT){
                    let maxFief = null;
                    let maxRes = 0;
                    for(const sourceFief of Object.keys(Memory.kingdom.fiefs)){
                        let sourceWares = heap.kingdomStatus.fiefs[sourceFief].wares;
                        if(!sourceWares[each] || sourceWares[each] < MINIMUM_LAB_PRODUCTION_AMOUNT) continue;
                        if(sourceWares[each] > maxRes){
                            maxRes = sourceWares[each];
                            maxFief = sourceFief;
                        }
                    }
                    addTerminalRequest(maxFief,fiefName,each,Math.min(MAX_INGREDIENT_REQUEST,maxRes));
                    break;
                }
            }
        }
    }
}

function addTerminalRequest(source,target,resource,resourceAmount){
    if(!heap.terminalRequests) heap.terminalRequests = {};
    if(!heap.terminalRequests[source]) heap.terminalRequests[source] = {};
    if(heap.terminalRequests[source][resource]) return;
    heap.terminalRequests[source][resource] = {targetFief:target,amount:resourceAmount};
    chronicle.log(`${source} received terminal request: Ship ${resourceAmount} ${resource} to ${target}`,'granary',3);
}

function getLabTargets(kingdomWares) {
    let needToMake = {};
    let canMake = {};
    let validNeedRes = [];
    let validCanRes = [];
    //Check which lab resources we can make
    for(const resource of Object.keys(REACTION_INGREDIENTS)) {  
        const ingredients = REACTION_INGREDIENTS[resource]      
        const currentAmount = kingdomWares[resource];
        const resourceTier = getResourceTier(resource);
        const belowMin = currentAmount < RESOURCE_TIER_MIN_AMOUNTS[resourceTier];
        const aboveMax = currentAmount > RESOURCE_TIER_MAX_AMOUNTS[resourceTier];
        if(!aboveMax) {
            //Check if we have enough ingredients to qualify for production
            if(kingdomWares[ingredients[0]] > MINIMUM_LAB_PRODUCTION_AMOUNT && kingdomWares[ingredients[1]] > MINIMUM_LAB_PRODUCTION_AMOUNT) {
                //Add to needToMake if below the minimum, else add as an option to make if no minimums need met
                if(belowMin){
                    if(!needToMake[resourceTier]) needToMake[resourceTier] = [resource];
                    else needToMake[resourceTier].push(resource)
                    validNeedRes.push(resource)
                }
                else{
                    if(!canMake[resourceTier]) canMake[resourceTier] = [resource];
                    else canMake[resourceTier].push(resource);
                    validCanRes.push(resource)
                }
            }
        }
    }
        
    if(Object.keys(needToMake).length) return [needToMake,validNeedRes];
    return [canMake,validCanRes];
}
function getResourceTier(resource){
    if(!resource) return 0;
    
    //Tier 1 compounds
    if(resource.length === 2 || resource === 'ZK' || resource === 'UL') {
        return 1;
    }
    
    //Tier 2 compounds
    if(resource.length === 4) {
        return 2;
    }
    
    //Tier 3 compounds
    if(resource.length === 5) {
        return 3;
    }
    
    return 0; //Unknown or other resources
}

module.exports = granary;
profiler.registerObject(granary, 'granary');