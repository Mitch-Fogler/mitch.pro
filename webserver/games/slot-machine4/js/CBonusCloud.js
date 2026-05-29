function CBonusCloud(oParentContainer){
    var _iWidthCloud;
    var _aClouds;
    
    var _oContainer;
    var _oParentContainer = oParentContainer;
    
    this._init = function(){
        _oContainer = new createjs.Container();
        _oParentContainer.addChild(_oContainer);
        
        
        _aClouds = new Array();
        
        var oSpriteCloud = s_oSpriteLibrary.getSprite("clouds");
        _iWidthCloud = oSpriteCloud.width;
        var oCloud = createBitmap(oSpriteCloud);
        oCloud.x = -_iWidthCloud;
        oCloud.regY = oSpriteCloud.height;
        oCloud.y = CANVAS_HEIGHT;
        _oContainer.addChild(oCloud);

        _aClouds.push(oCloud);
        
        var oCloud = createBitmap(oSpriteCloud);
        oCloud.x = 0;
        oCloud.regY = oSpriteCloud.height;
        oCloud.y = CANVAS_HEIGHT;
        _oContainer.addChild(oCloud);
        
        _aClouds.push(oCloud);
    };
    
    this.update = function(){
        for(var i=0;i<_aClouds.length;i++){
            _aClouds[i].x += 1;
            
            if(_aClouds[i].x > CANVAS_WIDTH){
                _aClouds[i].x = -_iWidthCloud;
            }
        }
    };
    
    this._init();
}