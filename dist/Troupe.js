const DemoLance = require('DemoLance');
const RangedLance = require('RangedLance');
const MeleeDuoLance = require('MeleeDuoLance');
const helper = require('functions.helper')


function Troupe(mission) {
    this.name = helper.getWarName();
    this.lances = [];
    this.mission = mission;
    //Lances needed will depend on mission. Generally start at 1 and escalate if needed
    this.lancesNeeded  = 1;
    global.heap.army.troupes.push(this)
}

Troupe.prototype.addLance = function(lance) {
    this.lances.push(lance);
};

Troupe.prototype.createLance = function(type) {
    let details = {}
    switch(type){
        case 'demo':
            details.targetHits = getTargetHits(this.mission.targets);
            //console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new DemoLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
        case 'rangedHarass':
            //console.log("Troupe create lance details:",JSON.stringify(details))
            this.lances.push(new RangedLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`,details));
            break;
    }
    
}

Troupe.prototype.removeLance = function(lance) {
    this.lances = this.lances.filter(lanceName => lanceName !== lance.name);
};

Troupe.prototype.run = function(kingdomCreeps) {
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
        }
    }
    let readyFlag = true;
    //console.log("Creeps in troupe",this.name)
    for(let lance of this.lances){
        //console.log(kingdomCreeps[lance.name])
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
    //Give all demo creeps the first target. Later on, refine this by checking available space
    
    for(let lance of this.lances){
        //If no targets, complete the mission
        //if(!this.mission.targets.length){
          //  this.mission.complete();
            //return;
        //}
        //Check if target is dead
        //if(this.mission.targets.length){
          //  if(!Game.getObjectById(this.mission.targets[0])){
            //    this.mission.targets.shift();
           // }
            //for(let crp of kingdomCreeps[lance.name]){
              //  lance.target[crp.id] = this.mission.targets[0];
            //}
        //}
        lance.runCreeps(kingdomCreeps[lance.name])
    }
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