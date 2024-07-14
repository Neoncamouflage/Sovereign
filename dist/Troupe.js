const DemoLance = require('DemoLance');
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
    switch(type){
        case 'demo':
            this.lances.push(new DemoLance());
            break;
    }
    
}

Troupe.prototype.removeLance = function(lance) {
    this.lances = this.lances.filter(lanceName => lanceName !== lance.name);
};

Troupe.prototype.run = function(kingdomCreeps) {
    //If no base fief for spawning and grouping, assign one based on the mission location.
    if(!this.baseFief){
        this.baseFief = getBaseFief(this);
    }
    //If we don't have enough lances, get more
    if(this.lances.length < this.lancesNeeded){
        switch(this.mission.type){
            case 'demo':
                this.lances.push(new DemoLance(`${this.name.split(' ')[1]} ${this.lances.length+1}`))
                break;
        }
    }
    let readyFlag = true;
    console.log("Creeps in troupe",this.name)
    for(let lance of this.lances){
        console.log(kingdomCreeps[lance.name])
        //If understaffed, populate
        if(!kingdomCreeps[lance.name] || kingdomCreeps[lance.name].length < lance.unitsNeeded){
            lance.populate(this.baseFief,kingdomCreeps);
            readyFlag = false;
        }
    }

    //If no targets, complete the mission
    if(!this.mission.targets.length){
        this.mission.complete();
        return;
    }
    //Give all demo creeps the first target. Later on, refine this by checking available space
    for(let lance of this.lances){
        for(let crp of kingdomCreeps[lance.name]){
            lance.target[crp.id] = this.mission.targets[0];
        }
        lance.runCreeps(kingdomCreeps[lance.name])
    }
};


function getBaseFief(troupe){
    let baseFief;
    //If it's a fief, just pick that one
    if(Memory.kingdom.fiefs[troupe.mission.room]){
        baseFief = Memory.kingdom.fiefs[troupe.mission.room]
    }
    //If it's a holding with a valid homefief, we pick that
    else if(Memory.kingdom.holdings[troupe.mission.room].homeFief){
        baseFief = Memory.kingdom.holdings[troupe.mission.room].homeFief;
    }
    //Else we find the closest fief and pick that
    else{
        let pickNum = Infinity;
        let pick = '';
        Object.keys(Memory.kingdom.fiefs).forEach(fief => {
            let dist = Game.map.getRoomLinearDistance(room, fief);
            if(dist < pickNum){
                pick = fief;
                pickNum = dist;
            }
        });
        baseFief = pick;
    }
    return baseFief
}

module.exports = Troupe;