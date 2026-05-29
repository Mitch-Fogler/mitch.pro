function CAvatar(oParentContainer){
    var _pStartPosAvatar;
    
    var _oSpriteAvatar;
    var _oSpriteThunder;
    var _oContainer;
    var _oParentContainer;
    
    this._init = function(){
        _pStartPosAvatar = {x:-150,y:CANVAS_HEIGHT};
        
        _oContainer = new createjs.Container();
        _oContainer.x = _pStartPosAvatar.x;
        _oContainer.y = _pStartPosAvatar.y;
        _oParentContainer.addChild(_oContainer);
        
        
        
        var aSprites = new Array();
        for(var t=0;t<350;t++){
            aSprites.push(s_oSpriteLibrary.getSprite("avatar_"+t))
        }

        var oData = {   // image to use
                        images: aSprites, 
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width: 649, height: 635,regX:0,regY:635},

                        animations: {  
                                        idle: [0, 89],win_0:[90,149,"idle"],win_1:[150,222,"idle"],
                                        start_freespin:[223,265,"start_lightning"],start_lightning:[266,287,"freespin_loop"],
                                        freespin_loop:[288,324],end_freespin:[325,349,"idle"] 
                                    }
        };
       
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oSpriteAvatar =  createSprite(oSpriteSheet, "start",0,635,649,635);    
        _oSpriteAvatar.on("animationend",this._onAnimationEnd,this);
        _oContainer.addChild(_oSpriteAvatar);
        
        var aSprites = new Array();
        for(var k=0;k<37;k++){
            aSprites.push( s_oSpriteLibrary.getSprite("thunder_avatar_"+k));
        }

        var oData = {   // image to use
                        images: aSprites, 
                        // width, height & registration point of each sprite
                        frames: {width:637,height:1080,regX:0,regY:1080},
                        animations: {  start:0,anim:[0,21] }
        };
       
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oSpriteThunder = new createjs.Sprite(oSpriteSheet, "start");
        _oSpriteThunder.visible = false;
        _oSpriteThunder.x = 162;
        _oSpriteThunder.y = 0;
        _oContainer.addChild(_oSpriteThunder);
        
        this.refreshButtonPos();
    };
    
    this._hideAllAnims = function(){
   
    };
    
    this.refreshButtonPos = function(){
        var iNewPos = _pStartPosAvatar.x + s_iOffsetX;
       
        if(iNewPos>0){
            _oContainer.x = 0;
        }else{
            _oContainer.x = _pStartPosAvatar.x + s_iOffsetX;
        }
        
        _oContainer.y = CANVAS_HEIGHT - s_iOffsetY;
    };
    
    this.show = function(szAnim){
        if(szAnim === "end_freespin"){
            _oSpriteThunder.gotoAndStop("start");
            _oSpriteThunder.visible = false;
        }else if(szAnim === "start_freespin"){
            _oSpriteThunder.gotoAndStop("start");
            _oSpriteThunder.visible = false;
            playSound("avatar_start_freespins",1,false);
        }
        
        _oSpriteAvatar.gotoAndPlay(szAnim);
    };
    
    this._onAnimationEnd = function(evt){
        if(evt.currentTarget.currentAnimation === "start_freespin"){
            _oSpriteThunder.visible = true;
            _oSpriteThunder.gotoAndPlay("anim");
        }
    };
    
    _oParentContainer = oParentContainer;
    
    this._init();
}