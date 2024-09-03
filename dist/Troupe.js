const DemoLance = require('DemoLance');
const RangedLance = require('RangedLance');
const BlinkyLance = require('BlinkyLance');
const MeleeLance = require('MeleeLance');
const MeleeDuoLance = require('MeleeDuoLance');
//When adding a new creep type, military roles in kingdomManager needs updated!!!


const helper = require('functions.helper')

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
        targetRoom: this.mission.room
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
    }
    
}

Troupe.prototype.removeLance = function(lance) {
    this.lances = this.lances.filter(lanceName => lanceName !== lance.name);
};

Troupe.prototype.run = function(kingdomCreeps) {
    if(this.mission.done){
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
            case 'destroyCore':
                this.createLance('melee');
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
    if(this.mission.type == 'defend'){
        defendLogic(this);
        return;
    }
    if(this.mission.type == 'destroyCore'){
        destroyCoreLogic(this);
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
            //console.log("Finding dist for",fief)
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
        let targetFind = room.find(FIND_HOSTILE_STRUCTURES)
        //If none, mission over
        if(!targetFind.length) this.mission.complete();
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