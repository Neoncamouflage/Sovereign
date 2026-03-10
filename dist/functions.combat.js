const profiler = require('screeps-profiler');

const combat = {
    //Calculates the defense needed for an attack and returns the creeps needed to the room
    calculateDefense: function(room,enemyCreeps){
        
    },
    getCombatStats: function(creeps){
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
}

module.exports = combat;    

profiler.registerObject(combat, 'functions.combat');