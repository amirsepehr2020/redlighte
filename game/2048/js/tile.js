function Tile(position,value){this.x=position.x;this.y=position.y;this.value=value||2;this.previousPosition=null;this.mergedFrom=null}
Tile.prototype.savePosition=function(){this.previousPosition={x:this.x,y:this.y}};Tile.prototype.updatePosition=function(p){this.x=p.x;this.y=p.y};Tile.prototype.serialize=function(){return{position:{x:this.x,y:this.y},value:this.value}};
