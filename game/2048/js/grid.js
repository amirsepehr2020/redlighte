function Grid(size,previousState){this.size=size;this.cells=previousState?this.fromState(previousState):this.empty()}
Grid.prototype.empty=function(){var c=[];for(var x=0;x<this.size;x++){var r=c[x]=[];for(var y=0;y<this.size;y++)r.push(null)}return c};
Grid.prototype.fromState=function(state){var c=[];for(var x=0;x<this.size;x++){var r=c[x]=[];for(var y=0;y<this.size;y++){var t=state[x][y];r.push(t?new Tile(t.position,t.value):null)}}return c};
Grid.prototype.randomAvailableCell=function(){var c=this.availableCells();return c.length?c[Math.floor(Math.random()*c.length)]:undefined};
Grid.prototype.availableCells=function(){var c=[];this.eachCell(function(x,y,t){if(!t)c.push({x:x,y:y})});return c};
Grid.prototype.eachCell=function(cb){for(var x=0;x<this.size;x++)for(var y=0;y<this.size;y++)cb(x,y,this.cells[x][y])};
Grid.prototype.cellsAvailable=function(){return!!this.availableCells().length};Grid.prototype.cellAvailable=function(c){return!this.cellOccupied(c)};Grid.prototype.cellOccupied=function(c){return!!this.cellContent(c)};Grid.prototype.cellContent=function(c){return this.withinBounds(c)?this.cells[c.x][c.y]:null};Grid.prototype.insertTile=function(t){this.cells[t.x][t.y]=t};Grid.prototype.removeTile=function(t){this.cells[t.x][t.y]=null};Grid.prototype.withinBounds=function(p){return p.x>=0&&p.x<this.size&&p.y>=0&&p.y<this.size};
Grid.prototype.serialize=function(){var s=[];for(var x=0;x<this.size;x++){var r=s[x]=[];for(var y=0;y<this.size;y++)r.push(this.cells[x][y]?this.cells[x][y].serialize():null)}return{size:this.size,cells:s}};
