const DemoLance = require('DemoLance');
const RangedLance = require('RangedLance');
const BlinkyLance = require('BlinkyLance');
const MeleeLance = require('MeleeLance');
const MeleeDuoLance = require('MeleeDuoLance');
const registry = require('registry')
const helper = require('functions.helper')
//When adding a new creep type, military roles in kingdomManager needs updated!!!



const lanceDefaults = {
    'defend':1,
    'destroyCore':1
}
const unitDefaults = {
    'defend':1,
    'destroyCore':1
}

function Troupe(mission) {
    this.name = helper.getWarName();
    this.lances = [];
    this.mission = mission;
    //Lances needed will depend on mission. Generally start at 1 and escalate if needed
    this.lancesNeeded  = lanceDefaults[mission.type] || 1;
    global.heap.army.troupes.push(this)
}

Troupe.prototype.addLance = function(lance) {
    this.lances.push(lance);
};

Troupe.prototype.createLance = function(type,options={}) {
    let details = {
        unitsNeeded: options.unitsNeeded || unitDefaults[this.mission.type] || 1,
        targetRoom: this.mission.room,
        ... options
    }
    switch(type){
        case 'demo':
            details.targetHits = getTargetHits(this.mission.targets);
            console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new DemoLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
        case 'ranged':
            console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new RangedLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
        case 'blinky':
            console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new BlinkyLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
        case 'melee':
            console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new MeleeLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
        //case 'harvest':
            //console.log("Troupe create lance details:",JSON.stringify(details))
            //this.lances.push(new HarvestLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            //break;
    }
    
}

Troupe.prototype.removeLance = function(lance) {
    this.lances = this.lances.filter(lanceName => lanceName !== lance.name);
};

Troupe.prototype.run = function(kingdomCreeps) {
    if(this.mission.done || !this.mission){
        for(let lance of this.lances){
            delete global.heap.army.lances[lance.name]
        }
        global.heap.army.troupes = global.heap.army.troupes.filter(trp => trp.name != this.name)
        return;
    }
    //If no base fief for spawning and grouping, assign one based on the mission location.
    if(!this.baseFief){
        this.baseFief = getBaseFief(this,kingdomCreeps);
    }
    
    //If we don't have enough lances, get more
    if(this.lances.length < this.lancesNeeded){
        switch(this.mission.type){
            case 'demo':
                this.createLance('demo');
                break;
            case 'rangedHarass':
                this.createLance('rangedHarass');
                break;
            case 'defend':
                this.createLance('blinky',{unitsNeeded: Game.rooms[this.baseFief].controller.level < 5 ? 2 : 1});
                break;
            case 'attack':
                this.createLance('blinky',{unitsNeeded: 1});
                break;
            case 'destroyCore':
                this.createLance('melee');
                break;
            case 'skMining':
                this.createLance('melee',{role:'halberdier',body:[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,MOVE,HEAL]});
                //this.createLance('harvest')
                break;
        }
    }
    let readyFlag = true;
    //console.log("Creeps in troupe",this.name)
    for(let lance of this.lances){
        console.log(kingdomCreeps[lance.name])
        //If understaffed, populate
        if(!kingdomCreeps[lance.name] || kingdomCreeps[lance.name].length < lance.unitsNeeded){
            lance.populate(this.baseFief,kingdomCreeps);
            readyFlag = false;
        }
    }
    if(this.mission.type == 'rangedHarass'){
        rangedHarassLogic(this);
        return;
    }
    if(this.mission.type == 'attack'){
        attackLogic(this);
        return;
    }
    if(this.mission.type == 'defend'){
        defendLogic(this);
        return;
    }
    if(this.mission.type == 'destroyCore'){
        destroyCoreLogic(this);
        return;
    }
    if(this.mission.type == 'skMining'){
        skMiningLogic(this);
        return;
    }
    //Give all demo creeps the first target. Later on, refine this by checking available space
};

function getTargetHits(targets){
    let hits = 0;
    for(let targetID of targets){
        let obj = Game.getObjectById(targetID);
        if(obj.hits) hits += obj.hits;
    }
    console.log("TARGETHITS",hits)
    return hits;
}

function getBaseFief(troupe){
    let baseFief;
    //If it's a fief, just pick that one
    if(Memory.kingdom.fiefs[troupe.mission.room]){
        baseFief = Memory.kingdom.fiefs[troupe.mission.room]
    }
    //If it's a holding with a valid homefief, we pick that
    else if(Memory.kingdom.holdings[troupe.mission.room] && Memory.kingdom.holdings[troupe.mission.room].homeFief){
        baseFief = Memory.kingdom.holdings[troupe.mission.room].homeFief;
    }
    //Else we find the closest fief and pick that
    else{
        let pickNum = Infinity;
        let pick = '';
        let roomName = troupe.mission.room;
        //console.log("Mission name:",roomName);
        //console.log("MEM FIEFS",Object.keys(Memory.kingdom.fiefs))
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            console.log("Finding dist for",roomName,fief)
            let dist = Game.map.getRoomLinearDistance(roomName, fief);
            if(dist < pickNum){
                pick = fief;
                pickNum = dist;
            }
        });
        baseFief = pick;
    }
    return baseFief
}

function destroyCoreLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    //If no vision, convoy
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, acquire targets
    else if(!targets.length && room){
        let targetFind = room.find(FIND_HOSTILE_STRUCTURES).filter(structure => structure.structureType != STRUCTURE_CONTROLLER)
        //If none, mission over
        if(!targetFind.length) troupe.mission.complete();
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'attack';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }

    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){
        console.log(JSON.stringify(lance))
        if(status == 'convoy'){
            //Navigate to the controller if possible, else default 25,25
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.controller){
                    lance.targetPos[crp.id] = {x:roomData.controller.x,y:roomData.controller.y,roomName:roomName}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName,range:20}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:3};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }
}

function demoLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    //If no vision, convoy
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, acquire targets
    else if(!targets.length && room){
        let targetFind = room.find(FIND_HOSTILE_CREEPS,{filter:(creep) => (!Memory.diplomacy.allies.includes(creep.owner.username) && !Memory.diplomacy.ceasefire.includes(creep.owner.username))})
        //If none, navigate to the room
        if(!targetFind.length) status = 'convoy';
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'attack';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }

    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){
        console.log(JSON.stringify(lance))
        if(status == 'convoy'){
            //Navigate to the controller if possible, else default 25,25
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.controller){
                    lance.targetPos[crp.id] = {x:roomData.controller.x,y:roomData.controller.y,roomName:roomName}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName,range:20}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:3};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }
}

function defendLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    //If no vision, convoy
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, acquire targets
    else if(!targets.length && room){
        let targetFind = room.find(FIND_HOSTILE_CREEPS,{filter:(creep) => (!Memory.diplomacy.allies.includes(creep.owner.username) && !Memory.diplomacy.ceasefire.includes(creep.owner.username))})
        //If none, navigate to the room
        if(!targetFind.length) status = 'convoy';
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'attack';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }

    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){
        console.log(JSON.stringify(lance))
        if(status == 'convoy'){
            //Navigate to the controller if possible, else default 25,25
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.controller){
                    lance.targetPos[crp.id] = {x:roomData.controller.x,y:roomData.controller.y,roomName:roomName}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName,range:20}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:3};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }

}

function defendLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    //If no vision, convoy
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, acquire targets
    else if(!targets.length && room){
        let targetFind = room.find(FIND_HOSTILE_CREEPS,{filter:(creep) => (!Memory.diplomacy.allies.includes(creep.owner.username) && !Memory.diplomacy.ceasefire.includes(creep.owner.username))})
        //If none, navigate to the room
        if(!targetFind.length) status = 'convoy';
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'attack';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }

    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){
        console.log(JSON.stringify(lance))
        if(status == 'convoy'){
            //Navigate to the controller if possible, else default 25,25
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.controller){
                    lance.targetPos[crp.id] = {x:roomData.controller.x,y:roomData.controller.y,roomName:roomName}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName,range:20}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:3};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }

}

function skMiningLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    let mineral;
    //If no vision, convoy to get there
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, check for targets
    else if(!targets.length && room){
        //Get our mineral
        if(!mineral) mineral = room.find(FIND_MINERALS)[0];
        //Get hostiles near the mineral
        let targetFind = mineral.pos.findInRange(FIND_HOSTILE_CREEPS,5,{filter:(creep) => (!isFriend(creep.owner.username))})
        //If none, navigate to the room
        if(!targetFind.length) status = 'convoy';
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'convoy';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }


    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){
        let flee = true;
        if(!kingdomCreeps[lance.name] || !kingdomCreeps[lance.name].length) flee = true;
        else{
            for(let creep of kingdomCreeps[lance.name]){
                creep.respawn(200,33)
                if(creep.room.name == roomName) flee = false;
            }
        }
        if(troupe.remoteHarvester && Game.getObjectById(troupe.remoteHarvester)) Game.getObjectById(troupe.remoteHarvester).memory.flee = flee
        if(troupe.remoteBuilder && Game.getObjectById(troupe.remoteBuilder)) Game.getObjectById(troupe.remoteBuilder).memory.flee = flee
        console.log(JSON.stringify(lance))
        if(status == 'convoy'){
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.mineral){
                    lance.targetPos[crp.id] = {x:roomData.mineral.x,y:roomData.mineral.y,roomName:roomName,range:3}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName,range:20}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:1};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }

    //Handle the mining stuff
    if(room){
        if(!mineral) mineral = room.find(FIND_MINERALS)[0];
        if(mineral.ticksToRegeneration){
            troupe.mission.complete();
            return;
        }
        //Get a can set up if there isn't
        let can = mineral.pos.findInRange(FIND_STRUCTURES,1).filter(struct => struct.structureType == STRUCTURE_CONTAINER)[0];
        if(!can){
            let site = mineral.pos.findInRange(FIND_MY_CONSTRUCTION_SITES,1).filter(struct => struct.structureType == STRUCTURE_CONTAINER)[0];
            //If no sites, make one
            if(!site){
                let spots = helper.getOpenSpots(mineral.pos);
                if(!spots.length){
                    console.log("NO OPEN SPOTS FOR SK MINERAL");
                    return;
                }
                room.createConstructionSite(spots[0].x,spots[0].y,STRUCTURE_CONTAINER);
            }
            //If we do have a site, get a builder if we don't have one
            else{
                let builder = troupe.remoteBuilder && Game.getObjectById(troupe.remoteBuilder) && (Game.getObjectById(troupe.remoteBuilder).ticksToLive > 200 || Game.getObjectById(troupe.remoteBuilder).spawning);
                if(!builder){
                    let checkCreeps = Object.values(Game.creeps).filter(crp => crp.memory.fief == troupe.baseFief && crp.memory.job == 'remoteBuilder' && crp.memory.targetRoom == room.name && (!troupe.remoteBuilder || troupe.remoteBuilder != crp.id));
                    if(checkCreeps.length){
                        troupe.remoteBuilder = checkCreeps[0].id
                    }
                    else{
                        registry.requestCreep({sev:34,memory:{role:'builder',job:'remoteBuilder',targetRoom:room.name,troupe:troupe.name,fief:troupe.baseFief,status:'spawning',preflight:false}})
                    }
                }
            }
        }
        //If the can is set up, call a harvester if we need one
        else{
            let harv = troupe.remoteHarvester && Game.getObjectById(troupe.remoteHarvester) && (Game.getObjectById(troupe.remoteHarvester).ticksToLive > 200 || Game.getObjectById(troupe.remoteHarvester).spawning);
            if(!harv){
                let checkCreeps = Object.values(Game.creeps).filter(crp => crp.memory.fief == troupe.baseFief && crp.memory.job == 'remoteHarvest' && crp.memory.targetRoom == room.name && (!troupe.remoteHarvester || troupe.remoteHarvester != crp.id));
                if(checkCreeps.length){
                    troupe.remoteHarvester = checkCreeps[0].id
                }
                else{
                    registry.requestCreep({sev:34,memory:{role:'harvester',job:'remoteHarvest',target:mineral.id,targetRoom:room.name,targetSpot:packPos(can.pos),troupe:troupe.name,fief:troupe.baseFief,status:'spawning',preflight:false}})
                }
                
            }
            //Submit supply request for the can if needed
            let canStore = can.store.getUsedCapacity();
            if(canStore > 50){
                for(let resType in can.store){
                    addSupplyRequest(Game.rooms[troupe.baseFief],{type:'pickup',resourceType:resType,amount:can.store.getUsedCapacity(resType),targetID:can.id,international:true,priority:6})
                }
            }
        }
    }



}


function rangedHarassLogic(troupe){
    let roomName = troupe.mission.room;
    let roomData = getScoutData(roomName);
    let room = Game.rooms[roomName];
    let targets = troupe.mission.targets || [];
    let status = 'none';
    let liveCreeps = [];
    //If no vision, convoy
    if(!room){
        status = 'convoy';
    }
    //If no target but we have vision, acquire targets
    else if(!targets.length && room){
        let targetFind = room.find(FIND_HOSTILE_CREEPS,{filter:(creep) => (!Memory.diplomacy.allies.includes(creep.owner.username) && !Memory.diplomacy.ceasefire.includes(creep.owner.username))})
        //If none, chill
        if(!targetFind.length) return;
        //Otherwise, assign them to the mission
        troupe.mission.targets = targetFind.map(crp => crp.id);
        status = 'attack';
    }
    //If we have targets and vision, remove any that are dead and keep attacking
    else{
        let flag = false;
        for(let crpID of targets){
            let creep = Game.getObjectById(crpID);
            if(!creep){
                flag = true;
                continue;
            }
            liveCreeps.push(crpID);
        }
        if(flag) troupe.mission.targets = liveCreeps;
        status = 'attack';
    }

    
    //Based on status result of the above logic, assign targets and positions to creeps
    for(let lance of troupe.lances){

        
        if(status == 'convoy'){
            //Navigate to the controller if possible, else default 25,25
            for(let crp of kingdomCreeps[lance.name]){
                if(roomData.controller){
                    lance.targetPos[crp.id] = {x:roomData.controller.x,y:roomData.controller.y,roomName:roomName}
                }
                else{
                    lance.targetPos[crp.id] = {x:25,y:25,roomName:roomName}
                }
            }
        }
        //If attacking, find the closest creep and go shoot it
        else if(status == 'attack'){
            for(let crp of kingdomCreeps[lance.name]){
                liveTargets = liveCreeps.map(cID => Game.getObjectById(cID));
                //console.log("Attack status for",crp,"with livecreeps",liveTargets)
                //let closest = crp.pos.findClosestByRange(liveTargets);
                let closest = crp.pos.getClosestByTileDistance(liveTargets);
                //console.log("Closest is",closest)
                if(!closest) continue;
                
                lance.target[crp.id] = closest.id;
                lance.targetPos[crp.id] = {x:closest.pos.x,y:closest.pos.y,roomName:roomName,range:3};

            }
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }

}

module.exports = Troupe;