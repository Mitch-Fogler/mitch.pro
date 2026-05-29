function CSuspanceEffect(oParentContainer){
    
    var _oSpriteThunder1;
    var _oSpriteThunder2;
    var _oContainer;
    var _oParentContainer = oParentContainer;
    
    this._init = function(){
        _oContainer = new createjs.Container();
       
        _oContainer.visible = false;
        _oParentContainer.addChild(_oContainer);
        
        var aSprites = new Array();
        for(var k=0;k<37;k++){
            aSprites.push( s_oSpriteLibrary.getSprite("thunder_avatar_"+k));
        }

        var oData = {   // image to use
                        images: aSprites, 
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width:637,height:1080,regX:0},
                        animations: {  start:0,anim:[0,21] ,anim_1:[15,21]}
        };
       
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oSpriteThunder1 = createSprite(oSpriteSheet, "start",0,0,637,1080);
        _oSpriteThunder1.scale = 0.7;
        _oContainer.addChild(_oSpriteThunder1);
        
        _oSpriteThunder2 = createSprite(oSpriteSheet, "start",0,0,637,1080);
        _oSpriteThunder2.x = SYMBOL_WIDTH-(446);
        _oSpriteThunder2.scale = 0.7;
        _oContainer.addChild(_oSpriteThunder2);
    };
    
    this.show = function(iX,iY){
        _oContainer.visible = true;
         _oContainer.alpha = 0;
        _oContainer.x = iX;
        _oContainer.y = iY;
        
        _oSpriteThunder1.gotoAndPlay("anim");
        _oSpriteThunder2.gotoAndPlay("anim_1");
        
        createjs.Tween.get(_oContainer).to({alpha:1}, 500, createjs.Ease.cubicOut);
        
        playSound("suspance",1,true);
    };
    
    this.hide = function(){
        _oContainer.visible = false;
        _oSpriteThunder1.gotoAndStop("start");
        _oSpriteThunder2.gotoAndStop("start");
        
        stopSound("suspance");
    };
    
    this._init();
}