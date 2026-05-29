function CBonusBut(iIndex,iXPos,iYPos,oParentContainer){
    var _bDisabled;
    var _bUpdate;
    var _iIndex = iIndex;

    
    var _aCbCompleted;
    var _aCbOwner;
    var _oListenerDown;
    var _oListenerUp;
    var _oListenerOver;
    
    var _oContainer;
    var _oHitArea;
    var _oJarAnim;
    var _oJar;
    var _oTween;
    var _oParentContainer = oParentContainer;
    
    var _oParent;
    
    this._init =function(iXPos,iYPos){
        _bDisabled = false;
        
        _aCbCompleted=new Array();
        _aCbOwner =new Array();
        
        _oContainer = new createjs.Container();
        _oContainer.x = iXPos;
        _oContainer.y = iYPos;
        _oParentContainer.addChild(_oContainer);
        
        var oSpriteColumn = s_oSpriteLibrary.getSprite("column_"+iIndex);
        var oColumn = createBitmap(oSpriteColumn);
        oColumn.regX = oSpriteColumn.width/2;
        oColumn.y = 254;
        _oContainer.addChild(oColumn);
        
        var aSpritesJar = new Array();
        for(var i=0;i<30;i++){
            aSpritesJar.push(s_oSpriteLibrary.getSprite('jar_anim_'+i));
        }
        
        var oData = {   // image to use
                        images: aSpritesJar, 
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width: 852, height: 546,regX:426}, 
                        animations: {  static: 0,anim:[0,29,"end"],end:29 }
        };

        var oSpriteSheet = new createjs.SpriteSheet(oData);   
        _oJarAnim = createSprite(oSpriteSheet, "static",426,0,852,546);
        _oJarAnim.visible = false;
        _oContainer.addChild(_oJarAnim);        
        
        _oJar = createBitmap(s_oSpriteLibrary.getSprite("jar"));
        _oJar.x = -86;
        _oJar.y = 14;
        _oContainer.addChild(_oJar);
        
        _oHitArea = new createjs.Shape();
        _oHitArea.graphics.beginFill("rgba(255,0,0,0.01)").drawRect(-oSpriteColumn.width/2,0,oSpriteColumn.width,oSpriteColumn.height);
        _oContainer.addChild(_oHitArea);
        
        _oListenerDown = _oHitArea.on("mousedown", this.buttonDown);
        _oListenerUp = _oHitArea.on("pressup" , this.buttonRelease);
        if(!s_bMobile){
            _oListenerOver = _oHitArea.on("mouseover", this.buttonOver);
        }  
        
        _bUpdate = false;
    };
    
    this.unload = function(){
        _oHitArea.off("mousedown", _oListenerDown);
        _oHitArea.off("pressup" , _oListenerUp);

        if(!s_bMobile){
             _oHitArea.off("mouseover", _oListenerOver);
        }
        
       _oParentContainer.removeChild(_oContainer);
    };
    
    this.setVisible = function(bVisible){
        _oContainer.visible = bVisible;
    };
    
    this.addEventListener = function( iEvent,cbCompleted, cbOwner ){
        _aCbCompleted[iEvent]=cbCompleted;
        _aCbOwner[iEvent] = cbOwner; 
    };
    
    this.buttonRelease = function(){
        if(_bDisabled){
            return;
        }

        if(_aCbCompleted[ON_MOUSE_UP]){
            _aCbCompleted[ON_MOUSE_UP].call(_aCbOwner[ON_MOUSE_UP],_iIndex);
        }
    };
    
    this.buttonDown = function(){
        if(_bDisabled){
            return;
        }

       if(_aCbCompleted[ON_MOUSE_DOWN]){
           _aCbCompleted[ON_MOUSE_DOWN].call(_aCbOwner[ON_MOUSE_DOWN]);
       }
    };
    
    this.buttonOver = function(evt){
        if(!s_bMobile){
            if(_bDisabled){
                return;
            }
            evt.target.cursor = "pointer";
        }  
    };

    
    
    
    this.tweenDown = function(iNewY,iTime){
        _oTween = createjs.Tween.get(_oContainer).to({y:iNewY}, iTime, createjs.Ease.backOut);
    };
    
    this.tweenUp = function(iNewY,iTime){
        _oTween = createjs.Tween.get(_oContainer).to({y:iNewY}, iTime, createjs.Ease.backIn).call(function(){_oParent.unload();});
    };
    
    this.explode = function(){
        _oJar.visible = false;
        _oJarAnim.visible = true;
        _oJarAnim.gotoAndPlay("anim");
        playSound("bonus_game_jar_explosion",1,false);
    };
    
    this.setScale = function(iScale){
        _oContainer.scaleX = _oContainer.scaleY = iScale;
    };
    
    this.getX = function(){
        return _oContainer.x;
    };
    
    this.getY = function(){
        return _oContainer.y;
    };
    
    this.update = function(){
        if(!_bUpdate){
            return;
        }
        
        
    };
    
    _oParent = this;
    this._init(iXPos,iYPos);
}