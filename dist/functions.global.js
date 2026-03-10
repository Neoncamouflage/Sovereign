const registry = require('registry');
const supplyDemand = require('supplyDemand');
const helper = require('functions.helper');
const Quad = require('Quad');
const profiler = require('screeps-profiler');
const Traveler = require('Traveler');
//Fetch a random integer from 0 to max(inclusive) and random array selection
global.randomInt = function(max) {
    return Math.floor(Math.random() * (max + 1));
};

//Random array selection
global.randomChoice = function(array) {
    return array[Math.floor(Math.random() * array.length)];
};

//Clamp to min/max bounds
global.clamp = function(number, min, max) {
  return Math.max(min, Math.min(number, max));
}

//Normalize between 0.0-1.0 for scoring
global.minMaxNormalize = function(value, max, min) {
    if (max - min == 0){
        return 0.5; // Prevent division by zero
    }
    return (value - min) / (max - min);
}

//Invert for when smaller numbers are scored higher
global.invertScore = function(v){
    return 1-v;
}

//Normalization of weights within a gene block
global.normalizeWeights = function(raw, floor = 0) {
    let sum = 0;
    for(let v of raw) sum += Math.max(floor, v);

    if (sum === 0) return raw.map(_ => 0);

    return raw.map(v => Math.max(floor, v) / sum);
}

//Per tick virtual store
global._vstoreInitTick = function () {
    if (!global.heap) global.heap = {};
    if (global.heap._vstoreTick !== Game.time) {
        global.heap._vstoreTick = Game.time;
        global.heap._vstore = Object.create(null);
    }
};
global._vstoreEnsure = function (creep) {
    _vstoreInitTick();
    let vs = global.heap._vstore[creep.id];
    if (vs) return vs;

    vs = Object.create(null);
    for (const res in creep.store) {
        const amt = creep.store[res] || 0;
        if (amt) vs[res] = amt;
    }
    global.heap._vstore[creep.id] = vs;
    return vs;
};
global.vstoreUsed = function (creep, resource) {
    const vs = _vstoreEnsure(creep);
    if (resource) return vs[resource] || 0;
    let sum = 0;
    for (const r in vs) sum += vs[r] || 0;
    return sum;
};
global.vstoreFree = function (creep) {
    const cap = creep.store.getCapacity() || 0;
    return Math.max(0, cap - vstoreUsed(creep));
};

global.vstoreObj = function (creep){
    const vs = _vstoreEnsure(creep);
    return vs;
}
global.vstoreUpdate = function (creep, action, resource, amount) {
    if (!amount) return;
    const vs = _vstoreEnsure(creep);

    if (action === 'transfer' || action === 'drop') amount = -amount;

    const before = vs[resource] || 0;
    let after = before + amount;
    if (after < 0) after = 0;

    if (after === 0) delete vs[resource];
    else vs[resource] = after;
};


//Update diplomacy
global.setDiplomacy = function(type,username){
    //Memory.diplomacy = {allies:[], ceasefire:[], outlaws:[],ledger:[]}
    //Update the list based on which type. If ally or enemy, also update scout data
    switch (type) {
        case 'ally':
            updateLists('allies', ['ceasefire', 'outlaws']);
            updateScoutData()
            break;
        case 'ceasefire':
            updateLists('ceasefire', ['allies', 'outlaws']);
            break;
        case 'enemy':
            updateLists('outlaws', ['allies', 'ceasefire']);
            updateScoutData()
            break;
        default:
            console.log("Invalid diplomacy type");
            break;
    }


    function updateLists(addToList, removeFromLists) {
        if (!Memory.diplomacy[addToList].includes(username)) {
            Memory.diplomacy[addToList].push(username);
        }

        removeFromLists.forEach(list => {
            let index = Memory.diplomacy[list].indexOf(username);
            if (index > -1) {
                Memory.diplomacy[list].splice(index, 1);
            }
        });
    }

    function updateScoutData(){
        let scoutData = getScoutData();
        let updatedRooms = [];
        for([roomName,roomData] of Object.entries(scoutData)){
            if(roomData.owner == username){
                roomData.ownerType = type;
                updatedRooms.push(roomName)
            }
        }
        if(updatedRooms.length){
            console.log(`Diplomacy standing updated. Fief status${updatedRooms.length == 1? '' : 'es'} changed to ${type}: ${updatedRooms.join(',')}.`)
        }
        else{
            console.log("Diplomacy standing updated. No known fiefs to update.")
        }
        
    }
}

global.isMe = function(target){
    if(!target){
        chronicle.log(`Failed isMe check as target is falsy: ${target}`,isMe,1);
        return false;
    }
    if(target instanceof String){
        return target.toLowerCase() == Memory.me.toLowerCase()
    }
    else if(typeof target === 'string'){
        return target.toLowerCase() == Memory.me.toLowerCase()
    }
    else if(target.username){
        return target.username.toLowerCase() == Memory.me.toLowerCase()
    }
    else if(target.owner && target.owner.username){
        return target.owner.username.toLowerCase() == Memory.me.toLowerCase()
    }
    
    
}

global.getDiplomacy = function(username){
    for(let [type,members] of Object.entries(Memory.diplomacy)){
        //console.log("Type",type,'Members',members)
        //Continue if we're not looking at one of the member lists
        if(!['allies','ceasefire','outlaws'].includes(type)){
            //console.log("Not valid, skip")
            continue;

        }
        //If they're on one of the lists, return their status
        if(members.includes(username)) return type;
    }
    //Not on any list, return neutral
    return 'neutral';
}

global.isSK = function(creep){
    return creep.owner.username == 'Source Keeper';
}

global.isFriend = function(target){
    let checkVal;
    if(target instanceof RoomObject){
        if(target.owner && target.owner.username){
            checkVal = target.owner.username;
        }
        else{
            //If neither of these then something's weird. Log it and return false.
            console.log("Unable to get diplo status of",target)
            return false;
        }
    }
    else if(typeof target === 'string' || target instanceof String){
        if(target == 'me' || isMe(target)) return true;
        checkVal = target;
    }
    else{
        //If neither string or roomobject, something's weird again. Log it and return.
        console.log("Diplo target is neither string nor object",target)
        return false;
    }
    //Get diplo status and return friendly check
    let diplo = getDiplomacy(checkVal);
    if(diplo == 'allies' || (target && target.room && diplo == 'ceasefire' && !Memory.kingdom.fiefs[target.room.name])){
        return true;
    }
    else{
        return false;
    }
}

global.removeScoutData = function(roomName){
    if(global.heap && global.heap.scoutData && global.heap.scoutData[roomName]) delete global.heap.scoutData[roomName];
}
//Scout Data Getter and Setter - Single is an optional string for a specific property
global.getScoutData = function(roomName=false){
        /**
     * roomName: r
     * lastRecord: l
     * roomType: t
     * ownerType: o
     * owner: w
     * controller: c
     * controllerLevel: u
     * towers: y
     * sources: s
     * mineral: m
     * exits: e
     * lairs: k
     */
    let scoutData = global.heap && global.heap.scoutData;
    //If first tick or no scout data for a specific room, return false
    if(!scoutData || (roomName && !scoutData[roomName])){
        //console.log("No scout data available! Room?",JSON.stringify(roomName))
        return false;
    }
    //No room name means all data
    if(!roomName){
        let roomData = {};
        for(let roomName of Object.keys(scoutData)){
            roomData[roomName] = convertData(roomName);
        }
        return roomData;
    }
    //Else just the requested room
    else{
        return convertData(roomName)
    }

    

    function convertData(roomName){
        const roomData = scoutData[roomName] || {};
        return {
            roomName: roomData.r || '',
            lastRecord: roomData.l || '',
            roomType: roomData.t || '',
            ownerType: roomData.o || '',
            owner: roomData.w || '',
            controller: roomData.c || '',
            controllerLevel: roomData.u || '',
            towers: roomData.y || '',
            sources: roomData.s || '',
            mineral: roomData.m || '',
            lairs: roomData.k || ''
        };
    }
}
global.setScoutData = function(room, data = {}, force = false) {
    try {
        if (!global.heap || !global.heap.scoutData) return;
        let scoutData = global.heap.scoutData;

        if (typeof room === 'string') {
            scoutData[room] = data;
            return;
        }

        if (!(room instanceof Room)) {
            console.log("Room name or object must be provided for scout data");
            return;
        }
        let lairs = [];
        let parsedType = describeRoom(room.name);
        if (parsedType == ROOM_SOURCE_KEEPER) {
            let hStructs = room.find(FIND_HOSTILE_STRUCTURES);
            if (!Memory.travelAvoid) {
                Memory.travelAvoid = {};
            }
            for(const struct of hStructs){
                if (!Memory.travelAvoid[room.name]) {
                    if (struct.structureType == STRUCTURE_INVADER_CORE) {
                        let total = struct.ticksToDeploy || 0;

                        if (struct.effects && struct.effects.length) {
                            let collapseEffect = struct.effects.find(e => e.effect == EFFECT_COLLAPSE_TIMER);
                            if (collapseEffect) {
                                total += collapseEffect.ticksRemaining;
                            }
                        }
                        Memory.travelAvoid[room.name] = { expiry: Game.time + total, type: 'stronghold' ,pos:{x:struct.x,y:struct.y}};
                    }
                }
                if(struct.structureType == STRUCTURE_KEEPER_LAIR) lairs.push({x:struct.x,y:struct.y});
            }
        }


        let [roomType, ownerType, owner] = helper.getRoomType(room);
        let sources = room.find(FIND_SOURCES).map(src => ({ x: src.pos.x, y: src.pos.y, id: src.id }));
        let mineral = room.find(FIND_MINERALS)[0];
        let towerPositions = room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).map(tow => ({ x: tow.pos.x, y: tow.pos.y }));

        global.heap.scoutData[room.name] = {
            r: room.name,
            l: Game.time,
            t: roomType,
            ...(ownerType && { o: ownerType }),
            ...(ownerType && owner && { w: owner }),
            ...(room.controller && { c: room.controller.pos }),

            ...(roomType === 'fief' && room.controller && room.controller.level && { u: room.controller.level }),
            ...(towerPositions.length && { y: towerPositions }),
            ...(sources.length && { s: sources }),
            ...(lairs.length && { k: lairs }),

            m: mineral ? { x: mineral.pos.x, y: mineral.pos.y, type: mineral.mineralType } : null
        };

        global.heap.newScoutData = true;

        if (global.heap && global.heap.scoutList && global.heap.scoutList[room.name]) {
            delete global.heap.scoutList[room.name];
        }

    } catch (e) {

        const roomName = (typeof room === 'string') ? room : (room && room.name);
        console.log(`Error in setScoutData for room ${roomName}: ${e.stack}`);
    }
}

//Get calculated tile distance across rooms
global.getTileDistance = function(pos1, pos2) {
    const ROOM_SIZE = 50;

    let dx, dy;

    if (pos1.roomName === pos2.roomName) {
        return pos1.getRangeTo(pos2);
    }

    const coord1 = parseRoomName(pos1.roomName);
    const coord2 = parseRoomName(pos2.roomName);

    const roomDeltaX = (coord2.x - coord1.x) * ROOM_SIZE;
    const roomDeltaY = (coord2.y - coord1.y) * ROOM_SIZE;

    dx = Math.abs((pos2.x + roomDeltaX) - pos1.x);
    dy = Math.abs((pos2.y + roomDeltaY) - pos1.y);

    return Math.max(dx, dy);
};

//Need to finish this
global.checkAdjacent = function(pos,func,use4 = false){
    if(!(pos instanceof RoomPosition)){
        if(!pos.pos){
            chronicle.log(`Invalid argument. ${pos} is not and does not contain a RoomPosition.`,'global.checkAdjacent',1)
            return null;
        }
        pos = pos.pos;
    }
    if(!pos.roomName){
        chronicle.log(`Position requires a roomName property.`,'global.checkAdjacent',1);
        return null;
    }
    let terrain = new Room.Terrain(pos.roomName);
    let directions = use4 ? DIRECTIONS_4 : DIRECTIONS_8;
    for(const dir of directions){
        let newX = pos.x+dir[0];
        let newY = pos.y+dir[1];
        if(newX < 0 || newY < 0 || newX > 49 || newY > 49) continue;
        //No default terrain check, we might want to check walls sometimes. This should be generic.
        //if(terrain.get(newX,newY) == TERRAIN_MASK_WALL) continue;

    }
}

//Parse room names into a world coordinate system
global.parseRoomName = function(roomName) {
    const coord = { x: 0, y: 0 };
    const match = /([EW])(\d+)([NS])(\d+)/.exec(roomName);

    if (match) {
        coord.x = parseInt(match[2], 10) * (match[1] === 'E' ? 1 : -1);
        coord.y = parseInt(match[4], 10) * (match[3] === 'N' ? 1 : -1);
    }

    return coord;
}

global.spawnCreep = function(role,body,fief,sev=50,memory = {}){
    //More robust sawning function needed at some point, to accept quick spawns and full detailed ones
    //let opts = {};
    //If string, get room name
    //if (typeof args === 'string' || args instanceof String){)
    //}

    if(!Array.isArray(body)) body = parseBody(body)
    memory.role = role
    if(!memory.fief) memory.fief = fief || Memory.kingdom.fiefs[Math.floor(Math.random() * Memory.kingdom.fiefs.length)]
    let plan = {
        sev:sev,
        body:body,
        hardSpawn:true,
        memory:memory
        }
    if(!Memory.hardSpawns) Memory.hardSpawns = {};
    if(!Memory.hardSpawns[fief]) Memory.hardSpawns[fief] = []; 
    Memory.hardSpawns[fief].push(plan)
}

global.isExit = function(spot){
    if(spot.x % 49 && spot.y % 49)return false;
    return true;
}

global.parseBody = function(bodyString){
    // '2W2M' => WORK,WORK,MOVE,MOVE
    // '2WM'  => WORK,MOVE,WORK,MOVE
    const bodyParts = [];
    const regex = /(\d+)([a-z]+)/gi;
    const partMap = {
        'w': WORK,
        'h': HEAL,
        'm': MOVE,
        'r': RANGED_ATTACK,
        't': TOUGH,
        'c': CARRY,
        'a': ATTACK,
        'p': CLAIM
    };
    let match;
    if (/^[a-z]+$/i.test(bodyString)) {
        const parts = bodyString.toLowerCase().split('').map(char => partMap[char]);
        bodyParts.push(...parts);
        return bodyParts;
    }
    while((match = regex.exec(bodyString)) !== null) {
        const count = parseInt(match[1]);
        const partSequence = match[2].toLowerCase().split('');
        const parts = partSequence.map(char => partMap[char]);
        for(let i = 0; i < count; i++) {
            bodyParts.push(...parts);
        }
    }
    return bodyParts;
}

global.describeRoom = function(name){
    const [EW, NS] = name.match(/\d+/g)
	if (EW%10 == 0 && NS%10 == 0) {
		return ROOM_CROSSROAD
	}
  	else if (EW%10 == 0 || NS%10 == 0) {
		return ROOM_HIGHWAY
	}
	else if (EW%5 == 0 && NS%5 == 0) {
		return ROOM_CENTER
	}
	else if (Math.abs(5 - EW%10) <= 1 && Math.abs(5 - NS%10) <= 1) {
		return ROOM_SOURCE_KEEPER
	}
	else {
		return ROOM_STANDARD
	}
}

global.convertStructure = function convertStructure(structure) {

    if (typeof structure === "number") {
        return Memory.structureFromNumReference[structure];
    }

    if (typeof structure === "string") {
        return Memory.structureToNumReference[structure];
    }
    chronicle.log(`Invalid structure: ${structure}`,'global.convertStructure',1)
};


global.BigCostMatrix = function() {
    this._bits = new Uint16Array(2500);
};

BigCostMatrix.prototype.set = function(xx, yy, val) {
    xx = xx|0;
    yy = yy|0;
    if (val > MAX_VALUE) {
        chronicle.log(`Matrix overflow. The provided value ${val} exceeds the maximum of ${MAX_VALUE}.`,'global.bigCostMatrix',1);
        val = MAX_VALUE;
    }
    this._bits[xx * 50 + yy] = Math.min(Math.max(0, val), MAX_VALUE);
};

BigCostMatrix.prototype.get = function(xx, yy) {
    xx = xx|0;
    yy = yy|0;
    return this._bits[xx * 50 + yy];
};

BigCostMatrix.prototype.serialize = function(){
    let out = "";
    const bits = this._bits;
    const len = bits.length;
    let i = 0;

    while (i < len) {
        const value = bits[i];
        let run = 1;
        while (i + run < len && bits[i + run] === value) {
            run++;
        }
        if (run === 1) {
            //For a run of 1, simply output the value.
            //No flag is set the top bit remains clear
            out += String.fromCharCode(value);
        } else {
            //For runs longer than 1, set the flag bit in the value, then output the run length in the following character.
            out += String.fromCharCode(value | FLAG_MASK) + String.fromCharCode(run);
        }
        i += run;
    }
    return out;
};

BigCostMatrix.deserialize = function(serializedStr) {
    const matrix = new BigCostMatrix();
    const bits = matrix._bits;
    let idx = 0;
    for(let i = 0; i < serializedStr.length; i++) {
        const charCode = serializedStr.charCodeAt(i);
        if (charCode & FLAG_MASK) {
            //If the top bit is set, then this character is a flagged value.
            //Clear the flag to obtain the actual value.
            const value = charCode & ~FLAG_MASK;
            //The next character contains the run length.
            const run = serializedStr.charCodeAt(++i);
            for(let j = 0; j < run; j++) {
                bits[idx++] = value;
            }
        } else {
            //If the top bit is not set, it's a singleton value.
            bits[idx++] = charCode;
        }
    }
    return matrix;
};

global.getDistance = function(pos1,pos2,opts = {}){
    opts.maxOps ??= 20000;
    opts.maxRooms ??= 64;
    opts.roomCallback ??= function(roomName) {
            let room = Game.rooms[roomName];
            let costs = new PathFinder.CostMatrix;    
            if (room){
              room.find(FIND_STRUCTURES).forEach(function(struct) {
                  if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                  } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                             (struct.structureType !== STRUCTURE_RAMPART ||
                              !struct.my)) {
                    costs.set(struct.pos.x, struct.pos.y, 255);
                  }
                });
            }
            return costs;
          };
    let route = PathFinder.search(pos1,{pos:pos2,range:1},opts);
    let dist = route.path.length;
    let incomp = route.incomplete;
    return [dist,incomp]
}
global.getTravelPath = function(origin,destination,opts = {}){
    opts.maxOps ??= 100000;
    opts.maxRooms ??= 64;
    return Traveler.findTravelPath(origin,destination,opts)
}
global.getSerializedPath = function(startPos,path){
    return Traveler.serializePath(startPos,path);
}

global.purgeOldScoutData = function(amt = 20000){
    let data = global.heap && global.heap.scoutData;
    if(!data) return false;
    for(let [room,roomData] of Object.entries(getScoutData())){
        if((Game.time - roomData.lastRecord) > amt){
            removeScoutData(room);
        }
    }
    RawMemory.segments[SEGMENT_SCOUT_DATA] = JSON.stringify(global.heap.scoutData)
    global.heap.newScoutData = false;
}

global.addHolding = function(room,standby=false,homeRoom=null){
    //Reject if I've screwed up and set a fief or doubled up a holding
    if(Memory.kingdom.fiefs[room] || Memory.kingdom.holdings[room]) return -1;
    let pick;
    let pickNum = 99;
    //If no homeroom provided, loop through fiefs and find the closest room. Linear should generally work.
    if(homeRoom == null){
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            let dist = Game.map.getRoomLinearDistance(room, fief);
            if(dist < pickNum){
                pick = fief;
                pickNum = dist;
            }
        });
        Memory.kingdom.holdings[room] = {homeRoom:pick,standby:standby};
    }else{
        //Else use the homeroom provided
        Memory.kingdom.holdings[room] = {homeRoom:homeRoom,standby:standby};
    }
    
}
global.standby = function(holding){
    //Flip standby flag
    Memory.kingdom.holdings[holding].standby = !Memory.kingdom.holdings[holding].standby
    //Clear spawn queue of homeroom to remove holding creeps
    clearQueue(Memory.kingdom.holdings[holding].homeRoom);
}
global.clearQueue = function(room='all'){
    if(room == 'all'){
        Object.keys(Memory.kingdom.fiefs).forEach(fief =>{
            Memory.kingdom.fiefs[fief].spawnQueue = {};
        });
    }else{
        Memory.kingdom.fiefs[room].spawnQueue = {};
    }
}
global.setAlarm = function({roomName,alarmType='general',hostiles=[],manualExpiry=false,origin='global.setAlarm'} = {}){
    let expiration = manualExpiry || Game.time + Math.max(...hostiles.map(creep => creep.ticksToLive))
    heap.alarms[roomName] = {tick:Game.time,type:alarmType,creeps:hostiles.map(creep => creep.id),expiry:expiration}
    chronicle.log(`Alarm raised in room ${roomName}. Type: ${alarmType == 'creep' ? 'creep '+hostiles[0].owner.username : alarmType}. Hostile count: ${hostiles.length}. Expiration: ${expiration-Game.time} ticks.`,origin,3);
}

global.showMem = function(objectID){
    return JSON.stringify(Game.getObjectById(objectID).memory);
}
global.setMem = function(objectID,key,val){
    if(!Game.getObjectById(objectID)){
        chronicle.log(`Invalid ID! ${objectID}.`,'global.setMem',1);
    }
    Game.getObjectById(objectID).memory[key] = val
}

global.getCombatStats = function(creeps){
    let groupScores = {}
    for(let creep of creeps){
        let scores = {attack:0,rangedAttack:0,rangedMassAttack:0,heal:0,rangedHeal:0,dismantle:0,fatigue:0}
        for(let part of creep.body){
            if(!part.hits) continue;
            let type = part.type;
            let boosts = part.boost ? BOOSTS[type][part.boost] : {};
            if(type == HEAL){
                scores.heal += HEAL_POWER*(boosts.heal || 1);
                scores.rangedHeal += RANGED_HEAL_POWER*(boosts.rangedHeal || 1)
            }
            else if(type == RANGED_ATTACK){
                scores.rangedAttack += RANGED_ATTACK_POWER*(boosts.rangedAttack || 1);
                scores.rangedMassAttack += RANGED_ATTACK_POWER*(boosts.rangedMassAttack || 1);
            }
            else if(type == WORK){
                scores.dismantle += DISMANTLE_POWER*(boosts.dismantle || 1);
            }
            else if(type == ATTACK){
                scores.attack += ATTACK_POWER*(boosts.attack || 1);
            }
            else if(type == MOVE){
                scores.fatigue += 2*(boosts.fatigue || 1);
            }
            else if(type == TOUGH){
                //Find a way to track
            }
        }
        groupScores[creep.id] = scores;
    }
    return groupScores
}

global.getTowerMap = function(room,serialized=false){
    if(!(room instanceof Room)){
        chronicle.log(`Room object must be provided to generate a tower map.`,'global.getTowerMap',1)
        return false;
    }
    let tCM = new BigCostMatrix();
    let towers = room.find(FIND_STRUCTURES).filter(str=> str.structureType == STRUCTURE_TOWER);
    if(!towers.length) return tCM
    //console.log("TOWERS",towers)
    let terrain = Game.map.getRoomTerrain(room.name);
    for(let x=0;x<50;x++){
        for(let y=0;y<50;y++){
            if(terrain.get(x,y) == TERRAIN_MASK_WALL) continue;
            let totalDmg = 0;
            for(let each of towers){
                let range = Math.max(Math.abs(each.pos.x - x), Math.abs(each.pos.y - y));
                let amount = TOWER_POWER_ATTACK;
                if(range == 0) continue;
                if(range > TOWER_OPTIMAL_RANGE) {
                    if(range > TOWER_FALLOFF_RANGE) {
                        range = TOWER_FALLOFF_RANGE;
                    }
                    amount -= amount * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
                }
                amount = Math.floor(amount);
                totalDmg+=amount;
            }
            tCM.set(x,y,totalDmg);
        }
    }
    if(serialized) return tCM.serialize();
    return tCM;
}

global.getDamageMap = function(hostiles,stats, towerMap){
    if(!stats) stats = getCombatStats(hostiles);
    //Our damageCM is the provided tower map, if available;
    let damageCM = towerMap || getTowerMap(hostiles[0] && hostiles[0].room) || new BigCostMatrix();
    for(let creep of hostiles){
        for(let x=-3;x<=3;x++){
            for(let y=-3;y<=3;y++){
                let base = damageCM.get(creep.pos.x+x,creep.pos.y+y)
                base += stats[creep.id].rangedAttack;
                if([-1,0,1].includes(y) && [-1,0,1].includes(x)) base += stats[creep.id].attack;
                damageCM.set(creep.pos.x+x,creep.pos.y+y,base)
            }
        }
    }
    return damageCM;
}

global.getCreeps = function(role){
    return Object.values(Game.creeps).filter(creep => creep.memory.role == role)
}

global.testFunc = function(opts){
    let newQuad = new Quad(opts);
    console.log("Quad created",newQuad.name)
}
global.damageMap = function(hostiles,stats,towerMap){
    if(!stats) stats = getCombatStats(hostiles);
    //Our damageCM is the provided tower map, if available;
    let damageCM = towerMap || getTowerMap(hostiles[0] && hostiles[0].room) || new BigCostMatrix();
    console.log(JSON.stringify(damageCM))
    console.log(JSON.stringify(stats))
    for(let creep of hostiles){
        for(let x=-3;x<=3;x++){
            for(let y=-3;y<=3;y++){
                let base = damageCM.get(creep.pos.x+x,creep.pos.y+y)
                base += stats[creep.id].rangedAttack;
                if([-1,0,1].includes(y) && [-1,0,1].includes(x)) base += stats[creep.id].attack;
                damageCM.set(creep.pos.x+x,creep.pos.y+y,base)
            }
        }
    }
    Memory.test.testBigCM = damageCM.serialize();
    JSON.stringify(damageCM)
}
//Accepts a room plan change in the format of a single array of xy coordinates
global.changeRoomPlan = function(roomName,rcl,structure,update){
    if(!Memory.kingdom.fiefs[roomName])return "Room invalid"
    let plan = Memory.kingdom.fiefs[roomName].roomPlan
    let section = plan[rcl] && plan[rcl][structure]
    if(!section)return "RCL or structure invalid"
    if(section.length != update.length/2)return `Plan length of ${section.length} different than update length of ${update.length/2}`
    let newSection = []
    for(let index = 0;index<section.length;index+=2){
        newSection.push({x:update[index],y:update[index+1]})
    }
    
    Memory.kingdom.fiefs[roomName].roomPlan[rcl][structure] = newSection;
}

//Accepts 'add', 'remove', 'swap'
global.updatePlan = function(room,method,rcl,structure,coord1,coord2){
    if(!coord1.x || !coord1.y){
        console.log("Bad coords");
        return;
    }
    if(coord2 && (!coord2.x || !coord2.y)){
        console.log("Bad second coords");
        return;
    }
    if(!CONTROLLER_STRUCTURES[structure]){
        console.log("Bad structure");
        return;
    }
    let plan;
    if(room instanceof Room && room.name && Memory.kingdom.fiefs[room.name]){
        plan = Memory.kingdom.fiefs[room.name].roomPlan;
    }
    else if(Memory.kingdom.fiefs[room]){
        plan = Memory.kingdom.fiefs[room].roomPlan;
    }
    else console.log("Bad room")
    let arr = plan[rcl][structure];
    if(method == 'add'){
        if(arr) arr.push(coord1);
        else plan[rcl][structure] = [coord1];
    }
    if(method == 'remove'){
        if(!arr) return;
        let newarr = [];
        for(const each of arr){
            if(each.x == coord1.x && each.y == coord1.y) continue;
            newarr.push(each);
        } 
        plan[rcl][structure] = newarr;
    }
    if(method == 'swap'){
        if(!arr){
            console.log("Can't swap as the target array is empty");
            return;
        }
        let newarr = [];
        for(const each of arr){
            if(each.x == coord1.x && each.y == coord1.y) continue;
            newarr.push(each);
        }
        newarr.push(coord2);
        plan[rcl][structure] = newarr;
    }
}

setDiplomacy = profiler.registerFN(setDiplomacy, 'setDiplomacy');
isMe = profiler.registerFN(isMe, 'isMe');
getDiplomacy = profiler.registerFN(getDiplomacy, 'getDiplomacy');
isFriend = profiler.registerFN(isFriend, 'isFriend');
removeScoutData = profiler.registerFN(removeScoutData, 'removeScoutData');
getScoutData = profiler.registerFN(getScoutData, 'getScoutData');
setScoutData = profiler.registerFN(setScoutData, 'setScoutData');
getTileDistance = profiler.registerFN(getTileDistance, 'getTileDistance');
parseRoomName = profiler.registerFN(parseRoomName, 'parseRoomName');
spawnCreep = profiler.registerFN(spawnCreep, 'spawnCreep');
isExit = profiler.registerFN(isExit, 'isExit');
parseBody = profiler.registerFN(parseBody, 'parseBody');
describeRoom = profiler.registerFN(describeRoom, 'describeRoom');
convertStructure = profiler.registerFN(convertStructure, 'convertStructure');
getDistance = profiler.registerFN(getDistance, 'getDistance');
purgeOldScoutData = profiler.registerFN(purgeOldScoutData, 'purgeOldScoutData');
addHolding = profiler.registerFN(addHolding, 'addHolding');
standby = profiler.registerFN(standby, 'standby');
clearQueue = profiler.registerFN(clearQueue, 'clearQueue');
setAlarm = profiler.registerFN(setAlarm, 'setAlarm');
showMem = profiler.registerFN(showMem, 'showMem');
getCombatStats = profiler.registerFN(getCombatStats, 'getCombatStats');
getTowerMap = profiler.registerFN(getTowerMap, 'getTowerMap');
getDamageMap = profiler.registerFN(getDamageMap, 'getDamageMap');
getCreeps = profiler.registerFN(getCreeps, 'getCreeps');
damageMap = profiler.registerFN(damageMap, 'damageMap');
changeRoomPlan = profiler.registerFN(changeRoomPlan, 'changeRoomPlan');
//marketCalc = profiler.registerFN(marketCalc, 'marketCalc');
profiler.registerClass(BigCostMatrix, 'BigCostMatrix');