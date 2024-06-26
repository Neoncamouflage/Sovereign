const profiler = require('screeps-profiler');
const roomPlanner = {
    //Returns a bunker plan for a room
    run: function(room){
        //Determine if the room already has a spawn
        let roomSpawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.name);
        //If spawn, get its coordinates to reference
        if(roomSpawns.length > 0){
            let keepSpawn = roomSpawns.find(name => {
                let words = name.split(" ");
                return words[0] === "Keep" || words[1] === "Keep";
            });
            //Spawn Coordinates
            let kPos = Game.spawns[keepSpawn].pos;
            console.log(kPos.x,kPos.y);
            //Use it to tell where the rest of the bunker goes
            let plan = this.getPlan(kPos.x,kPos.y,room.controller.level);
            //console.log(JSON.stringify(plan))
            /*for(let building in plan){
                if(Array.isArray(plan[building])){
                    plan[building].forEach(coordinate => {
                        room.visual.structure(coordinate.x,coordinate.y,building);
                    });
                }
            }*/
            return plan;
        };
        
        //If no spawn, run room calculations to determine spawn location
        return null;
    },
    //Get raw plan for the bunker
    getRawPlan: function(level=8){
        //Old Plans
        //Return plan based on controller level
        let offset = [15,11];
        let plan2 = '{"rcl":2,"buildings":{"extension":[{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12}],"spawn":[{"x":15,"y":11}],"container":[{"x":16,"y":11}]}}'
        let plan3 = '{"rcl":3,"buildings":{"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":14,"y":9}],"spawn":[{"x":15,"y":11}],"tower":[{"x":21,"y":11}],"container":[{"x":16,"y":11}]}}'
        let plan4 = '{"rcl":4,"buildings":{"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":26,"y":11},{"x":26,"y":10},{"x":26,"y":9},{"x":25,"y":9}],"spawn":[{"x":15,"y":11}],"storage":[{"x":20,"y":11}],"tower":[{"x":21,"y":11}],"road":[{"x":23,"y":11},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}'
        let plan5 = '{"rcl":5,"buildings":{"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":24,"y":10},{"x":24,"y":9},{"x":25,"y":9},{"x":26,"y":9},{"x":26,"y":10},{"x":26,"y":11},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":21,"y":13},{"x":19,"y":13},{"x":18,"y":14},{"x":20,"y":14},{"x":19,"y":15},{"x":22,"y":14},{"x":21,"y":15},{"x":20,"y":15}],"spawn":[{"x":15,"y":11}],"link":[{"x":20,"y":10}],"storage":[{"x":20,"y":11}],"tower":[{"x":22,"y":10},{"x":21,"y":11}],"road":[{"x":23,"y":11},{"x":23,"y":10},{"x":23,"y":9},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":19,"y":8},{"x":20,"y":8},{"x":22,"y":8},{"x":23,"y":8},{"x":24,"y":8},{"x":25,"y":8},{"x":26,"y":8},{"x":27,"y":8},{"x":21,"y":8},{"x":18,"y":8},{"x":16,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":19,"y":14},{"x":21,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":27,"y":10},{"x":27,"y":9},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":15,"y":7},{"x":18,"y":6},{"x":18,"y":7},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14},{"x":20,"y":13},{"x":22,"y":15},{"x":18,"y":15}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}'
        let plan6 = '{"rcl":6,"buildings":{"lab":[{"x":22,"y":7},{"x":21,"y":7},{"x":23,"y":7}],"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":24,"y":10},{"x":24,"y":9},{"x":25,"y":9},{"x":26,"y":9},{"x":26,"y":10},{"x":26,"y":11},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":21,"y":13},{"x":19,"y":13},{"x":22,"y":14},{"x":18,"y":14},{"x":15,"y":8},{"x":20,"y":14},{"x":19,"y":15},{"x":20,"y":15},{"x":21,"y":15},{"x":23,"y":15},{"x":22,"y":16},{"x":17,"y":15},{"x":18,"y":16},{"x":19,"y":16},{"x":21,"y":16},{"x":16,"y":7},{"x":17,"y":8},{"x":17,"y":7}],"spawn":[{"x":15,"y":11}],"link":[{"x":20,"y":10}],"storage":[{"x":20,"y":11}],"tower":[{"x":22,"y":10},{"x":21,"y":11}],"terminal":[{"x":19,"y":11}],"road":[{"x":23,"y":11},{"x":23,"y":10},{"x":23,"y":9},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":19,"y":8},{"x":20,"y":8},{"x":22,"y":8},{"x":23,"y":8},{"x":24,"y":8},{"x":25,"y":8},{"x":26,"y":8},{"x":27,"y":8},{"x":21,"y":8},{"x":18,"y":8},{"x":16,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":19,"y":14},{"x":21,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":27,"y":10},{"x":27,"y":9},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":15,"y":7},{"x":13,"y":6},{"x":13,"y":5},{"x":13,"y":7},{"x":14,"y":5},{"x":15,"y":5},{"x":16,"y":5},{"x":17,"y":5},{"x":18,"y":5},{"x":18,"y":6},{"x":18,"y":7},{"x":20,"y":5},{"x":22,"y":5},{"x":24,"y":5},{"x":25,"y":5},{"x":26,"y":5},{"x":23,"y":5},{"x":21,"y":5},{"x":19,"y":5},{"x":27,"y":5},{"x":27,"y":6},{"x":27,"y":7},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14},{"x":20,"y":13},{"x":18,"y":15},{"x":22,"y":15},{"x":17,"y":16},{"x":23,"y":16}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}'
        let plan7 = '{"rcl":7,"buildings":{"lab":[{"x":22,"y":7},{"x":21,"y":7},{"x":20,"y":7},{"x":19,"y":7},{"x":19,"y":6},{"x":23,"y":7}],"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":24,"y":10},{"x":24,"y":9},{"x":25,"y":9},{"x":26,"y":9},{"x":26,"y":10},{"x":26,"y":11},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":21,"y":13},{"x":19,"y":13},{"x":20,"y":14},{"x":21,"y":15},{"x":22,"y":14},{"x":18,"y":14},{"x":23,"y":15},{"x":17,"y":15},{"x":20,"y":15},{"x":19,"y":15},{"x":17,"y":8},{"x":17,"y":7},{"x":17,"y":6},{"x":16,"y":6},{"x":16,"y":7},{"x":15,"y":6},{"x":14,"y":6},{"x":14,"y":7},{"x":14,"y":8},{"x":15,"y":8},{"x":22,"y":16},{"x":21,"y":16},{"x":19,"y":16},{"x":18,"y":16},{"x":16,"y":15},{"x":24,"y":15},{"x":25,"y":15},{"x":15,"y":15}],"spawn":[{"x":20,"y":9},{"x":15,"y":11}],"link":[{"x":20,"y":10}],"storage":[{"x":20,"y":11}],"tower":[{"x":21,"y":9},{"x":22,"y":10},{"x":21,"y":11}],"factory":[{"x":18,"y":10}],"terminal":[{"x":19,"y":11}],"road":[{"x":23,"y":11},{"x":23,"y":10},{"x":23,"y":9},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":19,"y":8},{"x":20,"y":8},{"x":22,"y":8},{"x":23,"y":8},{"x":24,"y":8},{"x":25,"y":8},{"x":26,"y":8},{"x":27,"y":8},{"x":21,"y":8},{"x":18,"y":8},{"x":16,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":19,"y":14},{"x":21,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":27,"y":10},{"x":27,"y":9},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":15,"y":7},{"x":13,"y":6},{"x":13,"y":5},{"x":13,"y":7},{"x":14,"y":5},{"x":15,"y":5},{"x":16,"y":5},{"x":17,"y":5},{"x":18,"y":5},{"x":18,"y":6},{"x":18,"y":7},{"x":20,"y":5},{"x":22,"y":5},{"x":24,"y":5},{"x":25,"y":5},{"x":26,"y":5},{"x":23,"y":5},{"x":21,"y":5},{"x":19,"y":5},{"x":27,"y":5},{"x":27,"y":6},{"x":27,"y":7},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14},{"x":20,"y":13},{"x":18,"y":15},{"x":22,"y":15},{"x":17,"y":16},{"x":23,"y":16}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}'
        //{"rcl":8,"buildings":{"lab":[{"x":22,"y":7},{"x":21,"y":7},{"x":20,"y":7},{"x":19,"y":7},{"x":19,"y":6},{"x":20,"y":6},{"x":21,"y":6},{"x":22,"y":6},{"x":23,"y":7},{"x":23,"y":6}],"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":24,"y":10},{"x":24,"y":9},{"x":25,"y":9},{"x":26,"y":9},{"x":26,"y":10},{"x":26,"y":11},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":24,"y":7},{"x":25,"y":7},{"x":26,"y":7},{"x":24,"y":6},{"x":25,"y":6},{"x":26,"y":6},{"x":21,"y":13},{"x":19,"y":13},{"x":26,"y":12},{"x":26,"y":13},{"x":14,"y":12},{"x":14,"y":13},{"x":20,"y":14},{"x":21,"y":15},{"x":22,"y":14},{"x":18,"y":14},{"x":23,"y":15},{"x":17,"y":15},{"x":22,"y":16},{"x":20,"y":15},{"x":19,"y":15},{"x":21,"y":16},{"x":19,"y":16},{"x":18,"y":16},{"x":16,"y":15},{"x":15,"y":15},{"x":24,"y":15},{"x":25,"y":15},{"x":17,"y":8},{"x":17,"y":7},{"x":17,"y":6},{"x":16,"y":6},{"x":16,"y":7},{"x":15,"y":6},{"x":14,"y":6},{"x":14,"y":7},{"x":14,"y":8},{"x":15,"y":8}],"spawn":[{"x":20,"y":9},{"x":25,"y":11},{"x":15,"y":11}],"link":[{"x":20,"y":10}],"storage":[{"x":20,"y":11}],"tower":[{"x":21,"y":9},{"x":22,"y":9},{"x":22,"y":10},{"x":22,"y":11},{"x":21,"y":11},{"x":18,"y":11}],"factory":[{"x":18,"y":10}],"powerSpawn":[{"x":18,"y":9}],"terminal":[{"x":19,"y":11}],"nuker":[{"x":19,"y":9}],"road":[{"x":23,"y":11},{"x":23,"y":10},{"x":23,"y":9},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":19,"y":8},{"x":20,"y":8},{"x":22,"y":8},{"x":23,"y":8},{"x":24,"y":8},{"x":25,"y":8},{"x":26,"y":8},{"x":27,"y":8},{"x":21,"y":8},{"x":18,"y":8},{"x":16,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":19,"y":14},{"x":21,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":27,"y":10},{"x":27,"y":9},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":15,"y":7},{"x":13,"y":6},{"x":13,"y":5},{"x":13,"y":7},{"x":14,"y":5},{"x":15,"y":5},{"x":16,"y":5},{"x":17,"y":5},{"x":18,"y":5},{"x":18,"y":6},{"x":18,"y":7},{"x":20,"y":5},{"x":22,"y":5},{"x":24,"y":5},{"x":25,"y":5},{"x":26,"y":5},{"x":23,"y":5},{"x":21,"y":5},{"x":19,"y":5},{"x":27,"y":5},{"x":27,"y":6},{"x":27,"y":7},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14},{"x":20,"y":13},{"x":18,"y":15},{"x":22,"y":15},{"x":18,"y":17},{"x":22,"y":17},{"x":23,"y":16},{"x":25,"y":16},{"x":26,"y":15},{"x":14,"y":15},{"x":21,"y":17},{"x":19,"y":17},{"x":17,"y":16},{"x":15,"y":16},{"x":16,"y":16},{"x":24,"y":16},{"x":20,"y":17}],"observer":[{"x":20,"y":16}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}
        let plan8 = '{"rcl":8,"buildings":{"lab":[{"x":22,"y":7},{"x":21,"y":7},{"x":20,"y":7},{"x":19,"y":7},{"x":19,"y":6},{"x":20,"y":6},{"x":21,"y":6},{"x":22,"y":6},{"x":23,"y":7},{"x":23,"y":6}],"extension":[{"x":16,"y":9},{"x":16,"y":10},{"x":15,"y":9},{"x":14,"y":9},{"x":14,"y":10},{"x":14,"y":11},{"x":15,"y":12},{"x":15,"y":13},{"x":16,"y":13},{"x":17,"y":13},{"x":17,"y":12},{"x":24,"y":10},{"x":24,"y":9},{"x":25,"y":9},{"x":26,"y":9},{"x":26,"y":10},{"x":26,"y":11},{"x":25,"y":12},{"x":25,"y":13},{"x":24,"y":13},{"x":23,"y":13},{"x":23,"y":12},{"x":24,"y":7},{"x":25,"y":7},{"x":26,"y":7},{"x":24,"y":6},{"x":25,"y":6},{"x":26,"y":6},{"x":21,"y":13},{"x":19,"y":13},{"x":26,"y":12},{"x":26,"y":13},{"x":14,"y":12},{"x":14,"y":13},{"x":20,"y":14},{"x":21,"y":15},{"x":22,"y":14},{"x":18,"y":14},{"x":23,"y":15},{"x":17,"y":15},{"x":22,"y":16},{"x":20,"y":15},{"x":19,"y":15},{"x":21,"y":16},{"x":19,"y":16},{"x":18,"y":16},{"x":16,"y":15},{"x":15,"y":15},{"x":24,"y":15},{"x":25,"y":15},{"x":17,"y":8},{"x":17,"y":7},{"x":17,"y":6},{"x":16,"y":6},{"x":16,"y":7},{"x":15,"y":6},{"x":14,"y":6},{"x":14,"y":7},{"x":14,"y":8},{"x":15,"y":8}],"spawn":[{"x":20,"y":9},{"x":25,"y":11},{"x":15,"y":11}],"link":[{"x":20,"y":10}],"storage":[{"x":20,"y":11}],"tower":[{"x":21,"y":9},{"x":22,"y":9},{"x":22,"y":10},{"x":22,"y":11},{"x":21,"y":11},{"x":18,"y":11}],"factory":[{"x":18,"y":10}],"powerSpawn":[{"x":18,"y":9}],"terminal":[{"x":19,"y":11}],'+
        '"nuker":[{"x":19,"y":9}],"road":[{"x":23,"y":11},{"x":23,"y":10},{"x":23,"y":9},{"x":21,"y":12},{"x":20,"y":12},{"x":19,"y":12},{"x":18,"y":12},{"x":16,"y":11},{"x":17,"y":11},{"x":17,"y":10},{"x":17,"y":9},{"x":19,"y":8},{"x":20,"y":8},{"x":22,"y":8},{"x":23,"y":8},{"x":24,"y":8},{"x":25,"y":8},{"x":26,"y":8},{"x":27,"y":8},{"x":21,"y":8},{"x":18,"y":8},{"x":16,"y":8},{"x":13,"y":8},{"x":13,"y":9},{"x":13,"y":10},{"x":13,"y":11},{"x":15,"y":14},{"x":16,"y":14},{"x":17,"y":14},{"x":19,"y":14},{"x":21,"y":14},{"x":23,"y":14},{"x":24,"y":14},{"x":25,"y":14},{"x":27,"y":11},{"x":27,"y":10},{"x":27,"y":9},{"x":18,"y":13},{"x":22,"y":13},{"x":22,"y":12},{"x":15,"y":7},{"x":13,"y":6},{"x":13,"y":5},{"x":13,"y":7},{"x":14,"y":5},{"x":15,"y":5},{"x":16,"y":5},{"x":17,"y":5},{"x":18,"y":5},{"x":18,"y":6},{"x":18,"y":7},{"x":20,"y":5},{"x":22,"y":5},{"x":24,"y":5},{"x":25,"y":5},{"x":26,"y":5},{"x":23,"y":5},{"x":21,"y":5},{"x":19,"y":5},{"x":27,"y":5},{"x":27,"y":6},{"x":27,"y":7},{"x":13,"y":13},{"x":13,"y":14},{"x":14,"y":14},{"x":13,"y":12},{"x":27,"y":14},{"x":27,"y":13},{"x":27,"y":12},{"x":26,"y":14},{"x":20,"y":13},{"x":18,"y":15},{"x":22,"y":15},{"x":18,"y":17},{"x":22,"y":17},{"x":23,"y":16},{"x":25,"y":16},{"x":26,"y":15},{"x":14,"y":15},{"x":21,"y":17},{"x":19,"y":17},{"x":17,"y":16},{"x":15,"y":16},{"x":16,"y":16},{"x":24,"y":16},{"x":20,"y":17}],"observer":[{"x":20,"y":16}],"container":[{"x":16,"y":11},{"x":24,"y":11}]}}';
        switch(level){
            case 1:
                return '{"buildings":{}}';
            case 2:
                return plan2;
            case 3:
                return plan3;
            case 4:
                return plan4;
            case 5:
                return plan5;
            case 6:
                return plan6;
            case 7:
                return plan7;
            case 8:
                return plan8;
        }
        return;   
    },
    //Get the plan for the bunker based on Keep coordinates
    getPlan: function(x,y,level=8){
        let offset = [15,11];
        let delta = [x-offset[0], y-offset[1]];
        let rawPlan = this.getRawPlan(level);
        let basePlan = JSON.parse(this.getRawPlan(level))['buildings'];
        //Loop through and adjust all the coordinates by the offset
        for(let key in basePlan){
            if(Array.isArray(basePlan[key])){
                basePlan[key].forEach(coordinate => {
                    coordinate.x += delta[0];
                    coordinate.y += delta[1];
                });
            }
        }
        return basePlan;

    },
    getFF: function(spawnID){
        let temp = {coords:[]}
        let spawn = Game.getObjectById(spawnID);
        //console.log(spawn)
        const searchRange = 1;

        let spawnType = spawn.name.split(' ')[1];
        //console.log(spawn.pos.x,spawn.pos.y)
        let ffCan;
        //console.log(spawnCan)
        //console.log(spawnType)
        //console.log(ffCan)
        let spawnCan;
        switch(spawnType){
            //First Spawn
            case 'Keep':
                spawnCan = spawn.room.lookForAt(LOOK_STRUCTURES,spawn.pos.x+1,spawn.pos.y)
                spawnCan.forEach(can => {
                    if(can.structureType == STRUCTURE_CONTAINER){
                        ffCan = can.id
                    }
                })
                return {can:ffCan,coords:[[spawn.pos.x,spawn.pos.y-1],[spawn.pos.x+1,spawn.pos.y+1]]}
            case 'Hall':
                spawnCan = spawn.room.lookForAt(LOOK_STRUCTURES,spawn.pos.x-1,spawn.pos.y)
                spawnCan.forEach(can => {
                    if(can.structureType == STRUCTURE_CONTAINER){
                        ffCan = can.id
                    }
                })
                return {can:ffCan,coords:[[spawn.pos.x,spawn.pos.y-1],[spawn.pos.x-1,spawn.pos.y+1]]}
            //2nd Spawn intermediate
            case 'Mobile':
                
        }
    },
    getKeep: function(room){
        let roomSpawns = room.find(FIND_MY_SPAWNS).map(spawn => spawn.name);
        //If spawn, get its coordinates to reference
        if(roomSpawns.length > 0){
            let keepSpawn = roomSpawns.find(name => {
                let words = name.split(" ");
                return words[0] === "Keep" || words[1] === "Keep";
            });
            return Game.spawns[keepSpawn];
        };
    },
    getCM: function(room){
        let kSpawn = this.getKeep(room);
        let newCM = new PathFinder.CostMatrix;
        let plan = this.getPlan(kSpawn.pos.x,kSpawn.pos.y,8)

        for(let building in plan){
            if(Array.isArray(plan[building])){
                plan[building].forEach(coordinate => {
                    let floor = room.lookForAt(LOOK_TERRAIN,coordinate.x,coordinate.y);
                    if(building == STRUCTURE_ROAD && floor[0] != 'wall'){
                        //Plan roads with priority, not including on walls
                        newCM.set(coordinate.x,coordinate.y,1);
                    }else if(building != STRUCTURE_CONTAINER && building != STRUCTURE_RAMPART){
                        //Make planned buildings unwalkabe
                        newCM.set(coordinate.x,coordinate.y,0xff)
                    }
                });
            }
        }
        return newCM
    },
    getStoragePos: function(room){
        let kSpawn = this.getKeep(room);
        let plan = this.getPlan(kSpawn.pos.x,kSpawn.pos.y,4)
        let storage =  plan[STRUCTURE_STORAGE][0];
        return new RoomPosition(storage.x,storage.y,room.name);
    },
    getManagerPos: function(room){
        let kSpawn = this.getKeep(room);
        let plan = this.getPlan(kSpawn.pos.x,kSpawn.pos.y,4)
        let storage =  plan[STRUCTURE_STORAGE][0];
        return new RoomPosition(storage.x-1,storage.y-1,room.name);
    },
    getRamparts: function(room){
        //Rampart positions, two sets because they'll have different hit levels
        let outerRamparts = [
            {"x":13,"y":6},
            {"x":13,"y":7},
            {"x":13,"y":8},
            {"x":13,"y":9},
            {"x":13,"y":10},
            {"x":13,"y":11},
            {"x":13,"y":12},
            {"x":13,"y":13},
            {"x":13,"y":14},
            {"x":14,"y":15},
            {"x":14,"y":14},
            {"x":15,"y":15},
            {"x":16,"y":16},
            {"x":17,"y":16},
            {"x":18,"y":16},
            {"x":15,"y":16},
            {"x":19,"y":17},
            {"x":21,"y":17},
            {"x":22,"y":17},
            {"x":18,"y":17},
            {"x":20,"y":17},
            {"x":23,"y":16},
            {"x":24,"y":16},
            {"x":25,"y":16},
            {"x":26,"y":15},
            {"x":27,"y":13},
            {"x":27,"y":12},
            {"x":27,"y":11},
            {"x":27,"y":10},
            {"x":27,"y":9},
            {"x":27,"y":8},
            {"x":27,"y":7},
            {"x":27,"y":6},
            {"x":25,"y":5},
            {"x":23,"y":5},
            {"x":21,"y":5},
            {"x":20,"y":5},
            {"x":19,"y":5},
            {"x":18,"y":5},
            {"x":17,"y":5},
            {"x":16,"y":5},
            {"x":15,"y":5},
            {"x":14,"y":5},
            {"x":22,"y":5},
            {"x":24,"y":5},
            {"x":26,"y":5},
            {"x":27,"y":14},
            {"x":26,"y":6},
            {"x":26,"y":14},
            {"x":25,"y":15},
            {"x":22,"y":16},
            {"x":14,"y":6}
          ];
        let innerRamparts = [
            {"x":15,"y":6},
            {"x":16,"y":6},
            {"x":17,"y":6},
            {"x":18,"y":6},
            {"x":19,"y":6},
            {"x":20,"y":6},
            {"x":21,"y":6},
            {"x":22,"y":6},
            {"x":23,"y":6},
            {"x":24,"y":6},
            {"x":25,"y":6},
            {"x":26,"y":7},
            {"x":26,"y":8},
            {"x":26,"y":9},
            {"x":26,"y":10},
            {"x":26,"y":11},
            {"x":26,"y":12},
            {"x":26,"y":13},
            {"x":24,"y":15},
            {"x":23,"y":15},
            {"x":22,"y":15},
            {"x":21,"y":15},
            {"x":20,"y":15},
            {"x":19,"y":15},
            {"x":18,"y":15},
            {"x":17,"y":15},
            {"x":16,"y":15},
            {"x":19,"y":16},
            {"x":20,"y":16},
            {"x":21,"y":16},
            {"x":18,"y":14},
            {"x":17,"y":14},
            {"x":16,"y":14},
            {"x":15,"y":14},
            {"x":14,"y":13},
            {"x":14,"y":12},
            {"x":14,"y":11},
            {"x":14,"y":10},
            {"x":14,"y":9},
            {"x":14,"y":8},
            {"x":14,"y":7},
            {"x":15,"y":7},
            {"x":17,"y":7},
            {"x":18,"y":7},
            {"x":19,"y":7},
            {"x":20,"y":7},
            {"x":21,"y":7},
            {"x":22,"y":7},
            {"x":23,"y":7},
            {"x":24,"y":7},
            {"x":25,"y":7},
            {"x":25,"y":8},
            {"x":25,"y":9},
            {"x":25,"y":10},
            {"x":25,"y":11},
            {"x":25,"y":12},
            {"x":25,"y":13},
            {"x":25,"y":14},
            {"x":24,"y":14},
            {"x":23,"y":14},
            {"x":22,"y":14},
            {"x":21,"y":14},
            {"x":20,"y":14},
            {"x":19,"y":14},
            {"x":15,"y":13},
            {"x":15,"y":12},
            {"x":15,"y":11},
            {"x":15,"y":10},
            {"x":15,"y":9},
            {"x":15,"y":8},
            {"x":16,"y":7},
            {"x":24,"y":13},
            {"x":16,"y":13},
            {"x":17,"y":13},
            {"x":23,"y":13},
            {"x":24,"y":12},
            {"x":16,"y":12},
            {"x":16,"y":8},
            {"x":24,"y":8},
            {"x":20,"y":11},
            {"x":19,"y":11}
          ];
        //Offset for bunker
        let offset = [15,11];
        //Get position of room keep
        let keepPos = this.getKeep(room).pos;
        //Determine delta based on offset and keep position.
        let delta = [keepPos.x-offset[0],keepPos.y-offset[1]];

        //Loop through ramparts and adjust coordinates by the delta
        outerRamparts.forEach(spot =>{
            spot.x += delta[0];
            spot.y += delta[1];
        });
        innerRamparts.forEach(spot =>{
            spot.x += delta[0];
            spot.y += delta[1];
        });

        return [innerRamparts,outerRamparts];
    }
}

module.exports = roomPlanner;

profiler.registerObject(roomPlanner, 'roomPlanner');