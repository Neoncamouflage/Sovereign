const helper = require('functions.helper');
const registry = require('registry');
var roleDiver = {

    /** @param {Creep} creep **/
    run: function(creep) {
        creep.respawn();
        let term = creep.room.terminal;
        let store = creep.room.storage;
        let termEnergyGoal = 50000;
        if(creep.store.getUsedCapacity() > 0){
            if(creep.pos.getRangeTo(term) > 1) creep.travelTo(term)
            else{
                let temp = creep.transfer(term,Object.keys(creep.store)[0]);
            }
            return;
        }

        if(term.store[RESOURCE_ENERGY] < termEnergyGoal && store.store[RESOURCE_ENERGY] > 500){
            if(creep.pos.getRangeTo(store) > 1) creep.travelTo(store)
            else{creep.withdraw(store,RESOURCE_ENERGY)}
        }
        else if(term.store.getFreeCapacity() > (termEnergyGoal - term.store[RESOURCE_ENERGY])){
            if(creep.pos.getRangeTo(store) > 1) creep.travelTo(store)
            else{
                let pick = Object.keys(store.store)[0] == RESOURCE_ENERGY ? Object.keys(store.store)[1] : Object.keys(store.store)[0];
                creep.withdraw(store,pick);
            }
        }
    }
};

module.exports = roleDiver;

