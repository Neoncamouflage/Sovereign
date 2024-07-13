function Troupe(name) {
    this.name = name;
    this.lances = [];
}

Troupe.prototype.addLance = function(lance) {
    this.lances.push(lance);
};

Troupe.prototype.removeLance = function(lance) {
    this.lances = this.lances.filter(lanceName => lanceName !== lance.name);
};

Troupe.prototype.assignTargets = function() {
    // Logic to assign different targets to each Lance
    this.lances.forEach((lance, index) => {
        lance.target = `Target ${index + 1}`; // Example target assignment
    });
};

Troupe.prototype.run = function() {
    for(let lance of this.lances){
        lance.runCreeps();
    }
};