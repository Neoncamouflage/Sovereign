const helper = require('functions.helper');
var roleDuo = {

    /** @param {Creep} creep **/
    run: function(creeps) {
        let leader = creeps.filter(crp=>crp.memory.leader)[0];
        if(!leader){
            leader = creeps[0];
            leader.memory.leader = true;
        }
        
    }
};

module.exports = roleDuo;