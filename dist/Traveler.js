/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
const profiler = require('screeps-profiler');
const helper = require('functions.helper');
if(!Memory.travelAvoid) Memory.travelAvoid = {};
"use strict";
//Object.defineProperty(exports, "__esModule", { value: true });
class Traveler {
    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */
    static travelTo(creep, destination, options = {}) {
        if (!destination) {
            return ERR_INVALID_ARGS;
        }
        if (creep.fatigue > 0) {
            Traveler.circle(creep.pos, "aqua", .3);
            return ERR_TIRED;
        }

        options.creepRole = options.creepRole || creep.memory.role;
        options.creepState = options.creepState || creep.memory.state;
        let destinationIsPos = destination instanceof RoomPosition;
        destination = this.normalizePos(destination);
        
        options.optDest = destination
        options.fief = creep.memory.fief
        // manage case where creep is nearby destination
        let rangeToDestination = creep.pos.getRangeTo(destination);
        // -- If no offroad/ignore road value is set and the creep is a hauler, mark offroad if it's empty
        // -- Undoing this change because we have relaying now
        //if(!('offroad' in options) && !('ignoreRoads' in options)){
            //if(creep.memory.role == 'hauler' && creep.store.getUsedCapacity() == 0) options.offroad = true;
        //}
        if (options.range && ((options.flee && rangeToDestination > options.range) || (!options.flee && rangeToDestination <= options.range))) {
            return OK;
        }
        else if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !options.range) {
                //Not military and the target being an object means we assume range 1
                if(!options.military && !destinationIsPos){
                    return OK
                }
                let direction = creep.pos.getDirectionTo(destination);
                if (options.returnData) {
                    options.returnData.nextPos = destination;
                    options.returnData.path = direction.toString();
                }
                // -- Update this for creep move priority, relay flag/relay type, etc.
                this.movementIntents[creep.name] = {
                    x: creep.pos.x,
                    y: creep.pos.y,
                    roomName: creep.room.name,
                    direction:direction,
                    priority:options.priority||0
                }
                // -- Likely want to move this to the end, where we resolve intents. No need to call move() if we don't know
                // -- Make sure nothing we use depends on the move() return value, since that won't be returned
                creep.status = 'moving';
                return creep.move(direction);
            }
            return OK;
        }
        // initialize data object
        if (!creep.memory._trav) {
            delete creep.memory._travel;
            creep.memory._trav = {};
        }
        let travelData = creep.memory._trav;
        let state = this.deserializeState(travelData, destination);
        // uncomment to visualize destination
        // this.circle(destination.pos, "orange");
        // check if creep is stuck
        if (this.isStuck(creep, state)) {
            state.stuckCount++;
            Traveler.circle(creep.pos, "magenta", state.stuckCount * .2);
        }
        else {
            state.stuckCount = 0;
        }
        // handle case where creep is stuck
        if (!options.stuckValue) {
            options.stuckValue = DEFAULT_STUCK_VALUE;
        }
        if (state.stuckCount >= options.stuckValue && Math.random() > .5) {
            options.ignoreCreeps = false;
            options.freshMatrix = true;
            options.wasStuck = true;
            delete travelData.path;
        }
        // TODO:handle case where creep moved by some other function, but destination is still the same
        // delete path cache if destination is different
        if (!this.samePos(state.destination, destination)) {
            if (options.movingTarget && state.destination.isNearTo(destination)) {
                travelData.path += state.destination.getDirectionTo(destination);
                state.destination = destination;
            }
            else {
                delete travelData.path;
            }
        }
        // -- Pull a new CM and path if we're entering a live SK room, to avoid pathing issues
        if ([0,49].includes(creep.pos.x) || [0,49].includes(creep.pos.y) && describeRoom(creep.room.name) == ROOM_SOURCE_KEEPER && !options.allowSK){
            options.freshMatrix = true;
            delete travelData.path;
       }

        if (options.repath && Math.random() < options.repath) {
            // add some chance that you will find a new path randomly
            delete travelData.path;
        }
        // pathfinding
        let newPath = false;
        if (!travelData.path) {
            newPath = true;
            if (creep.spawning) {
                return ERR_BUSY;
            }
            state.destination = destination;
            let cpu = Game.cpu.getUsed();
            let ret = this.findTravelPath(creep.pos, destination, options);
            let cpuUsed = Game.cpu.getUsed() - cpu;
            state.cpu = _.round(cpuUsed + state.cpu);
            if (state.cpu > REPORT_CPU_THRESHOLD) {
                // see note at end of file for more info on this
                console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${creep.pos}, dest: ${destination}`);
            }
            let color = "orange";
            if (ret.incomplete) {
                //Incomplete path handling for creeps.
                if(creep.memory.role == 'scout'){
                    delete creep.memory.exitTarget;
                    delete creep.memory.lastRoom;
                }
                color = "red";
            }
            if (options.returnData) {
                options.returnData.pathfinderReturn = ret;
            }
            travelData.path = Traveler.serializePath(creep.pos, ret.path, color);
            state.stuckCount = 0;
        }
        this.serializeState(creep, destination, state, travelData);
        if (!travelData.path || travelData.path.length === 0) {
            return ERR_NO_PATH;
        }
        // consume path
        if (state.stuckCount === 0 && !newPath) {
            travelData.path = travelData.path.substr(1);
        }
        let nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            if (nextDirection) {
                let nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                if (nextPos) {
                    options.returnData.nextPos = nextPos;
                }
            }
            options.returnData.state = state;
            options.returnData.path = travelData.path;
        }
        //Record movement intent
        this.movementIntents[creep.name] = {
            x: creep.pos.x,
            y: creep.pos.y,
            roomName: creep.room.name,
            direction:nextDirection,
            priority:options.priority||0,
            role:creep.memory.role
        }
        creep.status = 'moving';
        return creep.move(nextDirection);
    }
    /**
     * make position objects consistent so that either can be used as an argument
     * @param destination
     * @returns {any}
     */
    static normalizePos(destination) {
        if (!(destination instanceof RoomPosition)) {
            return destination.pos;
        }
        return destination;
    }
    /**
     * check if room should be avoided by findRoute algorithm
     * @param roomName
     * @returns {RoomMemory|number}
     */
    static checkAvoid(roomName,military) {
        //Avoidance set up for things like strongholds
        if(Object.keys(Memory.travelAvoid).includes(roomName)){
            if(Memory.travelAvoid[roomName].expiry && Memory.travelAvoid[roomName].expiry < Game.time){
                chronicle.log(`Removing ${roomName} from avoidance list - Expiry time passed.`,'Traveler',3);
                delete Memory.travelAvoid[roomName];
                return false;
            }
            return true;
        }
        let roomData = getScoutData(roomName)
        if(global.heap.alarms[roomName] && !military) return true;
        if(roomData.roomType == 'fief' && !isFriend(roomData.owner)) return true;
        else {return false}
    }
    /**
     * check if a position is an exit
     * @param pos
     * @returns {boolean}
     */
    static isExit(pos) {
        return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
    }
    /**
     * check two coordinates match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static sameCoord(pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    }
    /**
     * check if two positions match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static samePos(pos1, pos2) {
        return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
    }
    /**
     * draw a circle at position
     * @param pos
     * @param color
     * @param opacity
     */
    static circle(pos, color, opacity) {
        new RoomVisual(pos.roomName).circle(pos, {
            radius: .45, fill: "transparent", stroke: color, strokeWidth: .15, opacity: opacity
        });
    }
    /**
     * update memory on whether a room should be avoided based on controller owner
     * @param room
     */
    static updateRoomStatus(room) {
        if (!room) {
            return;
        }
        if (room.controller) {
            Memory.avoidRooms = Memory.avoidRooms || [];
            if (room.controller.owner && !room.controller.my && !Memory.avoidRooms.includes(room.name)) {
                Memory.avoidRooms.push(room.name)
            }
            else if(Memory.avoidRooms && Memory.avoidRooms.includes(room.name)){
                Memory.avoidRooms = Memory.avoidRooms.filter(rm => rm != room.name)
            }
        }
    }
    /**
     * find a path from origin to destination
     * @param origin
     * @param destination
     * @param options
     * @returns {PathfinderReturn}
     */
    static findTravelPath(origin, destination, options = {}) {
        _.defaults(options, {
            ignoreCreeps: true,
            maxOps: DEFAULT_MAXOPS,
            range: 1,
            avoidSK:true
        });
        if (options.movingTarget) {
            options.range = 0;
        }
        origin = this.normalizePos(origin);
        destination = this.normalizePos(destination);
        let originRoomName = origin.roomName;
        let destRoomName = destination.roomName;
        // check to see whether findRoute should be used
        let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
        let allowedRooms = options.route;
        if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
            let route = this.findRoute(origin.roomName, destination.roomName, options);
            if (route) {
                allowedRooms = route;
            }
        }
        let roomsSearched = 0;
        let callback = (roomName) => {
            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            }  
            else if (Traveler.checkAvoid(roomName,options.military) && roomName !== destRoomName && roomName !== originRoomName) {
                return false;
            }
            roomsSearched++;
            let matrix;
            let room = Game.rooms[roomName];
            let data = getScoutData(roomName);
            
            //THESE ONLY CALL IF WE HAVE VISION
            if (room) {
                if (options.ignoreStructures) {
                    matrix = new PathFinder.CostMatrix();
                    if (!options.ignoreCreeps) {
                        Traveler.addCreepsToMatrix(room, matrix);
                    }
                }
                else if (options.ignoreCreeps || roomName !== originRoomName) {
                    matrix = this.getStructureMatrix(room, options);
                }
                else {
                    matrix = this.getCreepMatrix(room,options);
                }
                if (options.obstacles) {
                    matrix = matrix.clone();
                    for(let obstacle of options.obstacles) {
                        if (obstacle.pos.roomName !== roomName) {
                            continue;
                        }
                        matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
                    }
                }
                /*let hostiles = room.find(FIND_HOSTILE_CREEPS);
                if(hostiles.length){
                    for(let badCreep of hostiles){
                        if(!helper.isSoldier(badCreep)) continue;
                        for(let x = -3;x<=3;x++){
                            for(let y = -3;y<=3;y++){
                                matrix.set(badCreep.pos.x+x,badCreep.pos.y+y,60) //High score to try and avoid if at all possible
                            }
                        }
                    }
                }*/
            }
            if (!matrix) matrix = new PathFinder.CostMatrix();

            //Block out tiles around the lairs, sources, and mineral
            if (options.avoidSK && describeRoom(roomName) == ROOM_SOURCE_KEEPER && data.lairs){
                let terrain = new Room.Terrain(roomName);
                let targets = [
                    ...(data.sources ?? []),
                    ...(data.mineral ? [data.mineral] : [])
                ];
                for(let x = -4;x<=4;x++){
                    for(let y=-4;y<=4;y++){
                        for(const each of targets){
                            if(x==0 && y==0) continue;
                            let newX = each.x+x;
                            let newY = each.y+y;
                            if(newX<0 || newY<0 || newX>49 || newY>49) continue;
                            if(terrain.get(newX,newY) == TERRAIN_MASK_WALL) continue;
                            matrix.set(newX,newY,255);
                        }
                    }
                }

            }
            //else{
                //if (!matrix) matrix = new PathFinder.CostMatrix();

            //}
            if (options.roomCallback) {
                if (!matrix) {
                    matrix = new PathFinder.CostMatrix();
                }
                let outcome = options.roomCallback(roomName, matrix.clone());
                if (outcome !== undefined) {
                    return outcome;
                }
            }
            //Haulers should follow path plans
            /*if(options.creepRole == 'hauler' && !Memory.kingdom.fiefs[roomName] && Game.rooms[options.fief].controller.level <=4 
                && Memory.kingdom.holdings[destRoomName] && Memory.kingdom.holdings[destRoomName].sources){
                matrix = new PathFinder.CostMatrix();
                for(let source of Object.values(Memory.kingdom.holdings[destRoomName].sources)){
                    for(let spot of source.path){
                        if(spot.roomName == roomName){
                            matrix.set(spot.x,spot.y,1)
                        }
                    }
                }
            }*/
            
            return matrix;
        };
        let ret = PathFinder.search(origin, { pos: destination, range: options.range }, {
            maxOps: options.maxOps,
            maxRooms: options.maxRooms,
            plainCost: options.plainCost ? options.plainCost : options.offRoad ? 1 : options.ignoreRoads ? 1 : (options.creepRole == 'hauler' && options.creepState != 'refill') ? 5 : 2,
            swampCost: options.swampCost ? options.swampCost : options.offRoad ? 1 : options.ignoreRoads ? 5 : (options.creepRole == 'hauler' && options.creepState != 'refill') ? 25 : 10,
            roomCallback: callback,
        });
        if (ret.incomplete && options.ensurePath) {
            if (options.useFindRoute === undefined) {
                // handle case where pathfinder failed at a short distance due to not using findRoute
                // can happen for situations where the creep would have to take an uncommonly indirect path
                // options.allowedRooms and options.routeCallback can also be used to handle this situation
                if (roomDistance <= 2) {
                    console.log(`TRAVELER: path failed without findroute, trying with options.useFindRoute = true`);
                    console.log(`from: ${origin}, destination: ${destination}`);
                    options.useFindRoute = true;
                    ret = this.findTravelPath(origin, destination, options);
                    console.log(`TRAVELER: second attempt was ${ret.incomplete ? "not " : ""}successful`);
                    return ret;
                }
                // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
            }
            else {
            }
        }
        return ret;
    }
    /**
     * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
     * @param origin
     * @param destination
     * @param options
     * @returns {{}}
     */
    static findRoute(origin, destination, options = {}) {
        let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
        let allowedRooms = { [origin]: true, [destination]: true };
        let highwayBias = 1;
        if (options.preferHighway) {
            highwayBias = 2.5;
            if (options.highwayBias) {
                highwayBias = options.highwayBias;
            }
        }
        
        let ret = Game.map.findRoute(origin, destination, {
            routeCallback: (roomName) => {
                if (options.routeCallback) {
                    let outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                if (rangeToRoom > restrictDistance) {
                    // room is too far out of the way
                    return Number.POSITIVE_INFINITY;
                }
                if (!options.allowHostile && Traveler.checkAvoid(roomName,options.military) &&
                    roomName !== destination && roomName !== origin) {
                    // room is marked as "avoid" in room memory
                    return Number.POSITIVE_INFINITY;
                }
                if(Game.map.getRoomStatus(roomName).status == 'closed'){
                    //Room is closed
                    return Number.POSITIVE_INFINITY;
                }
                let parsed;
                if (options.preferHighway) {
                    parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                    if (isHighway) {
                        return 1;
                    }
                }
                // SK rooms are avoided when there is no vision in the room, harvested-from SK rooms are allowed
                /*if (options.allowSK && !Game.rooms[roomName]) {
                    if (!parsed) {
                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    }
                    let fMod = parsed[1] % 10;
                    let sMod = parsed[2] % 10;
                    let isSK = !(fMod === 5 && sMod === 5) &&
                        ((fMod >= 4) && (fMod <= 6)) &&
                        ((sMod >= 4) && (sMod <= 6));
                    if (isSK) {
                        return 2 * highwayBias;
                    }
                }*/
                return highwayBias;
            },
        });
        if (!_.isArray(ret)) {
            console.log(`couldn't findRoute to ${destination}`);
            return;
        }
        for(let value of ret) {
            allowedRooms[value.room] = true;
        }
        return allowedRooms;
    }
    /**
     * check how many rooms were included in a route returned by findRoute
     * @param origin
     * @param destination
     * @returns {number}
     */
    static routeDistance(origin, destination) {
        let linearDistance = Game.map.getRoomLinearDistance(origin, destination);
        if (linearDistance >= 32) {
            return linearDistance;
        }
        let allowedRooms = this.findRoute(origin, destination);
        if (allowedRooms) {
            return Object.keys(allowedRooms).length;
        }
    }
    /**
     * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
     * @param room
     * @param freshMatrix
     * @returns {any}
     */
    static getStructureMatrix(room, options) {
        let freshMatrix = options.freshMatrix;
        if (!this.structureMatrixCache[room.name] || (freshMatrix && Game.time !== this.structureMatrixTick)) {
            this.structureMatrixTick = Game.time;
            let matrix;
            //REMEMBER THIS ONLY CALLS IF WE HAVE VISION
            //THEY DON'T LISTEN TO THIS FOR NON-VISION ROOMS
            if(options.creepRole == 'hauler' && options.creepState != 'refill'){
                if(heap.travelMatrixes && heap.travelMatrixes[room.name]){
                    matrix = heap.travelMatrixes[room.name].clone()
                }
                else if(heap.matrixes && heap.matrixes[room.name]){
                    matrix = heap.matrixes[room.name].clone()
                }
                else{
                    matrix = new PathFinder.CostMatrix();
                }
            }
            else{
                matrix = new PathFinder.CostMatrix();
            }
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1,options);
        }
        return this.structureMatrixCache[room.name];
    }
    /**
     * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
     * @param room
     * @returns {any}
     */
    static getCreepMatrix(room,options) {
        if (!this.creepMatrixCache[room.name] || Game.time !== this.creepMatrixTick) {
            this.creepMatrixTick = Game.time;
            options.freshMatrix = true;
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room, options).clone());
        }
        return this.creepMatrixCache[room.name];
    }
    /**
     * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
     * @param room
     * @param matrix
     * @param roadCost
     * @returns {CostMatrix}
     */
    static addStructuresToMatrix(room, matrix, roadCost,options) {
        let creepRole = options.creepRole;
        let creepState = options.creepState;
        let destination = options.optDest;
        const terrain = new Room.Terrain(room.name);
        let impassibleStructures = [];

        //Haulers always follow the road path even if it isn't built
        /*if(creepRole == 'hauler' && !Memory.kingdom.fiefs[room.name] && Game.rooms[options.fief].controller.level <=4 
            && Memory.kingdom.holdings[destination] && Memory.kingdom.holdings[destination].sources){
            for(let source of Object.values(Memory.kingdom.holdings[destination].sources)){
                for(let spot of source.path){
                    if(spot.roomName == room.name & matrix.get(spot.x,spot.y) != 200){
                        matrix.set(spot.x,spot.y,1)
                    }
                }
            }
        }*/

        for(let structure of room.find(FIND_STRUCTURES)) {
            if (structure instanceof StructureRampart) {
                if (!structure.my && !structure.isPublic) {
                    impassibleStructures.push(structure);
                }
            }
            else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            }
            else if (structure instanceof StructureContainer) {
                matrix.set(structure.pos.x, structure.pos.y, 5);
            }
            // -- Don't step on portals
            else if(structure instanceof StructurePortal){
                impassibleStructures.push(structure);
            }
            else {
                impassibleStructures.push(structure);
            }
        }
        //Don't step on ally sites
        for(let site of room.find(FIND_CONSTRUCTION_SITES)) {
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD
                || site.structureType === STRUCTURE_RAMPART || (!isFriend(site) && !isMe(site.owner.username))) {
                continue;
            }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }
        
        for(let structure of impassibleStructures) {
            matrix.set(structure.pos.x, structure.pos.y, 0xff);
        }

        for(let crp of room.find(FIND_MY_CREEPS)){
            if(crp.memory.stay){
                matrix.set(crp.pos.x,crp.pos.y,200)
            }
        }
        return matrix;
    }
    /**
     * add creeps to matrix so that they will be avoided by other creeps
     * @param room
     * @param matrix
     * @returns {CostMatrix}
     */
    static addCreepsToMatrix(room, matrix) {
        room.find(FIND_CREEPS).forEach((creep) => {
            if(creep.owner.username == 'Source Keeper'){
                for(let x=-3;x<=3;x++){
                    for(let y=-3;y<=3;y++){
                        matrix.set(creep.pos.x+x, creep.pos.y+y, 0xff)
                    }
                }
            }
            else{
                matrix.set(creep.pos.x, creep.pos.y, 0xff)
            }
            
        });
        return matrix;
    }
    /**
     * reset movement intents for relaying
     * @param creep
     * @returns {any}
     */
    static resetMovementIntents(){
        this.movementIntents = {};
        if(global.heap)global.heap.relays = {};
    }
    /**
     * add creep movement intents to be executed after conflict resolution
     * @param creep
     * @returns {any}
     */
    static addMovementIntent(creep){
        return this.movementIntents[creep];
    }
    /**
     * return the movement intent object for a creep, containing destination x/y, direction, and roomName
     * @param creep
     * @returns {any}
     */
    static getMovementIntent(creep){
        return this.movementIntents[creep];
    }
    /**
     * check for relay opportunities between supply creeps
     */
    /*static relay(haulers){
        let missionHaulers = [];
        let emptyHaulers = [];
        let emptyPos = {};
        let relCount = 0; //Debugging
        
        for(let each of haulers){
            //Haulers on a task with inventory
            if((each.memory.task && each.memory.state == 'dropoff' && each.store.getUsedCapacity() > 0)
                || each.memory.refillTarget){
                let travelData = each.memory._trav;
                if(travelData)missionHaulers.push(each);
                //if(each.canRelay || each.memory.refillTarget)relCount++;
                
            }
            //Empty haulers without a task or picking up
            if(each.store.getUsedCapacity() == 0){
                emptyHaulers.push(each);
                emptyPos[`${each.pos.x},${each.pos.y}`] = each.id;
            }
        }
        //chronicle.log(`${relCount} refill/notask haulers attempting relay.`,'Traveler',4);
        //For each mission creep, check if there's an adjacent empty on the way with same size carry. If so, swap missions and cargo.
        for(let each of missionHaulers){
            if(!global.heap.relays && global.heap)global.heap.relays = {};
            if((each.id in heap.relays) || !each.memory._trav || !each.memory._trav.path) continue;
            let path = each.memory._trav.path.substr(1);
            let nextDirection = parseInt(path[0], 10);
            let selfStore = each.store.getUsedCapacity();
            
            //let empties = [];
            //This just loops and checks every adjacency.
            /*for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx === 0 && dy === 0) continue;
        
                    let adjacentKey = `${creep.pos.x + dx},${creep.pos.y + dy}`;
                    if(!emptyPos[adjacentKey]) continue;
                    let emptyCreep = Game.getObjectById(emptyPos[adjacentKey]);
                        //Check if there's room
                        if(emptyCreep.store.getFreeCapacity() < selfStore) continue;
                        //Add the creep to our empties options
                        empties.push(emptyCreep)
                }
            }
            const ax = [0, 0, 1, 1, 1, 0, -1, -1, -1];
            const ay = [0, -1, -1, 0, 1, 1, 1, 0, -1];
            let nextKey = `${each.pos.x + ax[nextDirection]},${each.pos.y + ay[nextDirection]}`;
            
            if(!emptyPos[nextKey]) continue;
            let targetCreep = Game.getObjectById(emptyPos[nextKey]);
            //if(each.canRelay || each.memory.refillTarget)chronicle.log(`${each} ${each.pos} attempting relay to ${targetCreep}`,'Traveler',4);
            let otherStore = targetCreep.store.getUsedCapacity();
            let eachState = each.memory.state;
            let otherState = targetCreep.memory.state;
            if(targetCreep.store.getFreeCapacity() < selfStore || targetCreep.store.getCapacity() != each.store.getCapacity()) continue;
            if(targetCreep.id in heap.relays) continue;
            //if(each.canRelay || each.memory.refillTarget)chronicle.log(`${each} passed check 1.`,'Traveler',4);
            let fullMission = each.memory.task ? heap.shipping[each.memory.fief].requests[each.memory.task] : null;
            //If the we have a mission, make sure we're not right next to the thing
            if(fullMission){
                let target = Game.getObjectById(fullMission.targetID);
                if(!target) continue;
                if(getTileDistance(each.pos,target.pos) <= 2) continue;
            }
            
            let emptyMission = targetCreep.memory.task ? global.heap.shipping[targetCreep.memory.fief].requests[targetCreep.memory.task] : null;
            console.log("SWAPPING")
            console.log("Full:",JSON.stringify(fullMission))
            console.log("Empty:",JSON.stringify(emptyMission))
            console.log("Giver:",JSON.stringify(each.memory))
            console.log("Taker:",JSON.stringify(targetCreep.memory))
            //Take empty creep's mission
            if(emptyMission){
                //ID
                each.memory.task = emptyMission.taskID;
                //Copy assigned amount and assign self to mission
                emptyMission.assignedHaulers[each.id] = emptyMission.assignedHaulers[targetCreep.id]
                //Remove old creep
                delete emptyMission.assignedHaulers[targetCreep.id]
            }
            //If no empty mission, just clear our task
            else{
                delete each.memory.task;
            }

            //Give our mission to the empty if needed
            if(fullMission){
                targetCreep.memory.task = fullMission.taskID
                //Copy assignment to the empty and remove us
                fullMission.assignedHaulers[targetCreep.id] = fullMission.assignedHaulers[each.id];
                delete fullMission.assignedHaulers[each.id]
            }
            //If they're refilling, swap refill targets
            if(each.memory.refillTarget || targetCreep.memory.refillTarget){
                let eachRefill = each.memory.refillTarget || false;
                let targetRefill = targetCreep.memory.refillTarget || false;
                each.memory.refillTarget = targetRefill;
                targetCreep.memory.refillTarget = eachRefill;
                //if(each.canRelay || each.memory.refillTarget)chronicle.log(`${each} swapping refill with ${targetCreep}.`,'Traveler',4);
            }
            targetCreep.memory.state = eachState;
            each.memory.state = otherState;
            //if(each.canRelay || each.memory.refillTarget)chronicle.log(`${each} passed state swap.`,'Traveler',4);
            //Swap store
            if(fullMission){
                each.transfer(targetCreep,fullMission.resourceType);
            }
            else{
                let resType = Object.keys(each.store)[0];
                each.transfer(targetCreep,resType)
            }
            //Set relay so the rest of the code knows they've already done it
            //Assign values to tell them what their new store amount is
            global.heap.relays[each.id] = otherStore;
            global.heap.relays[targetCreep.id] = selfStore;
            console.log("END SWAP")
            console.log("Full:",JSON.stringify(fullMission))
            console.log("Empty:",JSON.stringify(emptyMission))
            console.log("Giver:",JSON.stringify(each.memory))
            console.log("Taker:",JSON.stringify(targetCreep.memory))
        }


    }*/
    /**
     * resolve movement conflicts and execute moves
     * @param creep
     * @returns {any}
     */
    static resolveMovement(){
        const dx = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        const dy = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        let creeps = Object.keys(this.movementIntents).map(creepName => Game.creeps[creepName])
        //Sort creeps descending based on priority
        creeps.sort((a, b) => (b.memory.priority || PRIORITY_REF[b.memory.role] || 0) - (a.memory.priority || PRIORITY_REF[a.memory.role] || 0))

        //Go through the creeps from highest priority to lowest
        let conflictTargets = {};
        for(let creep of creeps){
            //If this creep was already shoved, skip it
            if(creep.shoved)continue;
            let creepData = this.movementIntents[creep.name];
            let nextX = creepData.x + dx[creepData.direction];
            let nextY = creepData.y + dy[creepData.direction];
            let roomName = creepData.roomName;
            //Return if dealing with a room edge
            if(nextX > 49 || nextY > 49 || nextX < 0 || nextY < 0) continue;


            //Check if there's a creep at its target position
            //console.log(roomName)
            let blocker
            try{blocker = Game.rooms[roomName].lookForAt(LOOK_CREEPS,nextX,nextY)[0];}
            catch(e){
                console.log('Traveler error',e,roomName);
                console.log(JSON.stringify(creepData))
                console.log(creep)
                continue;
            }
            //If there's a blocking creep and it isn't being shoved
            if(blocker && blocker.my && !blocker.shoved){
                let blockerData = this.movementIntents[blocker.name];
                //If it isn't moving and isn't fatigued, see if we can shove it
                if(!this.movementIntents[blocker.name] && blocker.fatigue == 0){
                    //console.log("SHOVIN")
                    let shoveResult = creep.shove(blocker);
                    //console.log("SHOVE RESULT",shoveResult)
                    if(shoveResult){
                        creep.say(LANGUAGE.shove)
                        //If shove was successful, add the resulting creep (at the end of the shove chain) to the conflict check
                        conflictTargets[`${roomName},${nextX},${nextY}`] = conflictTargets[`${roomName},${nextX},${nextY}`] || [];
                        conflictTargets[`${roomName},${nextX},${nextY}`].push(creep)
                    }
                    //If not, we cancel this move order
                    else{
                        creep.cancelOrder('move');
                        delete this.movementIntents[creep.name];
                    }
                }
                //If it's fat but we aren't, have it pull us
                else if(blocker.memory.fat && !creep.memory.fat && this.movementIntents[blocker.name]){
                    blocker.pull(creep);
                    creep.cancelOrder('move');
                    creep.move(blocker);
                    creep.isPulled = true;
                    blocker.say(LANGUAGE.pull)
                }
            }
            //If no blocker, check if it's a hauler. If so, add its move to the conflict check
            else if(!blocker && creep.memory.role == 'hauler'){
                conflictTargets[`${roomName},${nextX},${nextY}`] = conflictTargets[`${roomName},${nextX},${nextY}`] || [];
                conflictTargets[`${roomName},${nextX},${nextY}`].push(creep)
            }
        };

        //Check all conflicts to set priority. Shoves > Energy Haulers > Other Haulers > All Others
        for(let spot of Object.keys(conflictTargets)){
            let creepList = conflictTargets[spot];
            if(creepList.length > 1){
                //If the creep has the .shoved property, it has priority
                let shovedCreep = creepList.find(creep => creep.shoved);
                if(shovedCreep){
                    creepList.forEach(creep => {
                        if(!creep.shoved) creep.cancelOrder('move');
                    });
                    continue;
                }
                //Otherwise sort by priority: energy > other resources > empty
                let sortedCreeps = creepList.slice().sort((a, b) => {
                    let aEnergy = a.getStoreUsed(RESOURCE_ENERGY);
                    let bEnergy = b.getStoreUsed(RESOURCE_ENERGY);
                    let aTotal = a.getStoreUsed();
                    let bTotal = b.getStoreUsed();
                    
                    //Energy haulers first
                    if(aEnergy > 0 && bEnergy === 0) return -1;
                    if(bEnergy > 0 && aEnergy === 0) return 1;
                    
                    //Then other filled haulers
                    if(aTotal > 0 && bTotal === 0) return -1;
                    if(bTotal > 0 && aTotal === 0) return 1;
                    
                    //If same category, doesn't matter
                    return 0;
                });
                //Keep the highest priority creep, cancel the rest
                for(let i = 1; i < sortedCreeps.length; i++){
                    sortedCreeps[i].cancelOrder('move');
                }
            }
        }
    }
    /**
     * serialize a path, traveler style. Returns a string of directions. 
     * @param startPos
     * @param path
     * @param color
     * @returns {string}
     */
    static serializePath(startPos, path, color = "orange") {
        let serializedPath = "";
        let lastPosition = startPos;
        if(!(lastPosition instanceof RoomPosition)) lastPosition = new RoomPosition(lastPosition.x,lastPosition.y,lastPosition.roomName);
        this.circle(startPos, color);
        for(let position of path) {
            if(!(position instanceof RoomPosition)) position = new RoomPosition(position.x,position.y,position.roomName);
            if (position.roomName === lastPosition.roomName) {
                new RoomVisual(position.roomName)
                    .line(position, lastPosition, { color: color, lineStyle: "dashed" });
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    }

    static getNextPosition(creep){
        let err;
        if(!creep || !creep.memory || !creep.memory._trav){
            chronicle.log(`${creep} does not exist or does not have a _trav key.`,'Traveler.getNextPosition',1);
            return null;
        }
        let nextDirection = parseInt(creep.memory._trav.path[0], 10);
        return Traveler.positionAtDirection(creep.pos,nextDirection);
    }
    /**
     * returns a position at a direction relative to origin
     * @param origin
     * @param direction
     * @returns {RoomPosition}
     */
    static positionAtDirection(origin, direction) {
        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        let x = origin.x + offsetX[direction];
        let y = origin.y + offsetY[direction];
        if (x > 49 || x < 0 || y > 49 || y < 0) {
            return;
        }
        return new RoomPosition(x, y, origin.roomName);
    }
    /**
     * convert room avoidance memory from the old pattern to the one currently used
     * @param cleanup
     */
    static patchMemory(cleanup = false) {
        if (!Memory.empire) {
            return;
        }
        if (!Memory.empire.hostileRooms) {
            return;
        }
        let count = 0;
        for(let roomName in Memory.empire.hostileRooms) {
            if (Memory.empire.hostileRooms[roomName]) {
                if (!Memory.rooms[roomName]) {
                    Memory.rooms[roomName] = {};
                }
                Memory.rooms[roomName].avoid = 1;
                count++;
            }
            if (cleanup) {
                delete Memory.empire.hostileRooms[roomName];
            }
        }
        if (cleanup) {
            delete Memory.empire.hostileRooms;
        }
        console.log(`TRAVELER: room avoidance data patched for ${count} rooms`);
    }
    static deserializeState(travelData, destination) {
        let state = {};
        if (travelData.state) {
            state.lastCoord = { x: travelData.state[STATE_PREV_X], y: travelData.state[STATE_PREV_Y] };
            state.cpu = travelData.state[STATE_CPU];
            state.stuckCount = travelData.state[STATE_STUCK];
            state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y], travelData.state[STATE_DEST_ROOMNAME]);
        }
        else {
            state.cpu = 0;
            state.destination = destination;
        }
        return state;
    }
    static serializeState(creep, destination, state, travelData) {
        travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
            destination.roomName];
    }
    static isStuck(creep, state) {
        let stuck = false;
        if (state.lastCoord !== undefined) {
            if (this.sameCoord(creep.pos, state.lastCoord)) {
                // didn't move
                stuck = true;
            }
            else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
                // moved against exit
                stuck = true;
            }
        }
        return stuck;
    }
}

Traveler.structureMatrixCache = {};
Traveler.creepMatrixCache = {};
Traveler.movementIntents = {};
module.exports = Traveler;
profiler.registerClass(Traveler, 'Traveler');
// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;
const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 2;
const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;
// assigns a function to Creep.prototype: creep.travelTo(destination)
Creep.prototype.travelTo = function (destination, options) {
    return Traveler.travelTo(this, destination, options);
};