const registry = require('registry');
const supplyDemand = require('supplyDemand');
const helper = require('functions.helper');

//Update diplomacy
global.setDiplomacy = function setDiplomacy(type,username){
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
//Scout Data Getter and Setter - Single is an optional string for a specific property
global.getScoutData = function getScoutData(roomName=false,single=false){
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
     */
    let scoutData = global.heap.scoutData;
    //If first tick and no scout data, return false
    if(!scoutData || !scoutData[roomName]) return false;
    //No room name means all data
    if(!roomName) return scoutData;
    //Convert data
    let roomData = {
        roomName: scoutData[roomName]['r'],
        lastRecord: scoutData[roomName]['l'],
        roomType: scoutData[roomName]['t'],
        ownerType: scoutData[roomName]['o'],
        owner: scoutData[roomName]['w'],
        controller: scoutData[roomName]['c'],
        controllerLevel: scoutData[roomName]['u'],
        towers: scoutData[roomName]['t'],
        sources: scoutData[roomName]['s'],
        mineral: scoutData[roomName]['m'],
        exits: scoutData[roomName]['e']
    };
    if(!roomData){
        console.log(`No scout data for ${roomName}`)
        return false;
    }
    //If they don't want
    if(!single) return roomData;
    if(!roomData[single]){
        console.log(`${single} is not available in scout data for ${roomName}`);
        return false;
    }
    return roomData[single];
}
global.setScoutData = function setScoutData(room,data={},force=false){
    //console.log("Setting data for",room,JSON.stringify(data))
    let scoutData = global.heap.scoutData;
    //If first tick and no scout data, return
    if(!scoutData) return;
    //If room is a room name, add custom data directly.
    if(typeof room === 'string'){
        scoutData[room] = data;
        return;
    }
    if(!(room instanceof Room)){
        console.log("Room name or object must be provided for scout data");
        return;
    }

    let [roomType,ownerType,owner] = helper.getRoomType(room);
    let sources = room.find(FIND_SOURCES).map(src => {return {x:src.pos.x,y:src.pos.y,id:src.id}})
    let mineral = room.find(FIND_MINERALS)[0];
    let towerPositions = room.find(FIND_HOSTILE_STRUCTURES,{filter:{structureType:STRUCTURE_TOWER}}).map(tow => {return {x:tow.pos.x,y:tow.pos.y}});
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
     */
    global.heap.scoutData[room.name] = {
        r : room.name,
        l : Game.time,
        t: roomType,
        o: ownerType,
        w: ownerType ?  owner : null,
        c: room.controller ? {x:room.controller.pos.x,y:room.controller.pos.y} : null,
        u: roomType == 'fief' ? room.controller.level : null,
        y: towerPositions,
        s: sources,
        m: mineral ? {x:mineral.pos.x,y:mineral.pos.y,type:mineral.mineralType} : null,
        e: Game.map.describeExits(room.name),
    }
    if(Game.shard.name == 'shardSeason'){
        //global.heap.scoutData[room.name].scoreCollector = room.find(FIND_SCORE_COLLECTORS).map(coll => {return {x:coll.pos.x,y:coll.pos.y,id:coll.id}})
        //global.heap.scoreCans.push(... room.find(FIND_SCORE_CONTAINERS).map(can => {return {x:can.pos.x,y:can.pos.y,id:can.id}}))
    }
    global.heap.newScoutData = true;

}

//Get calculated tile distance across rooms
global.getTileDistance = function getTileDistance(pos1, pos2) {
    const ROOM_SIZE = 50;
    let posX;
    let posY;
    //Just do basic calculation if in the same room
    if (pos1.roomName === pos2.roomName) {
         posX = pos2.x - pos1.x;
         posY = pos2.y - pos1.y;
        return Math.sqrt(posX * posX + posY * posY);
    }
    const coord1 = parseRoomName(pos1.roomName);
    const coord2 = parseRoomName(pos2.roomName);
    

    const roomDeltaX = (coord2.x - coord1.x) * ROOM_SIZE;
    const roomDeltaY = (coord2.y - coord1.y) * ROOM_SIZE;

    posX = pos2.x + roomDeltaX - pos1.x;
    posY = pos2.y + roomDeltaY - pos1.y;

    return Math.sqrt(posX * posX + posY * posY);
}

//Parse room names into a world coordinate system
global.parseRoomName = function parseRoomName(roomName) {
    const coord = { x: 0, y: 0 };
    const match = /([EW])(\d+)([NS])(\d+)/.exec(roomName);

    if (match) {
        coord.x = parseInt(match[2], 10) * (match[1] === 'E' ? 1 : -1);
        coord.y = parseInt(match[4], 10) * (match[3] === 'N' ? 1 : -1);
    }

    return coord;
}

global.spawnCreep = function spawnCreep(role,body,fief,sev=50,memory = {}){
    memory.role = role
    memory.fief = fief || Memory.kingdom.fiefs[Math.floor(Math.random() * Memory.kingdom.fiefs.length)]
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

global.describeRoom = function describeRoom(name){
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
