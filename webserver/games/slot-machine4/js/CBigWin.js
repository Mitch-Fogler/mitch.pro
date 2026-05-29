function CBigWin(oParentContainer){
    var _aCbCompleted;
    var _aCbOwner;
    
    var _oFade;
    var _oTextWin;
    var _oTextWinStroke;
    var _oBigWin;
    var _oRollingScore;
    var _oContainer;
    var _oParentContainer = oParentContainer;
    
    this._init = function(){
        _aCbCompleted=new Array();
        _aCbOwner =new Array();
        
        _oContainer = new createjs.Container();
        _oContainer.visible = false;
        _oParentContainer.addChild(_oContainer);
        
        _oFade = new createjs.Shape();
        _oFade.graphics.beginFill("black").drawRect(0, 0, CANVAS_WIDTH,CANVAS_HEIGHT);
        _oContainer.addChild(_oFade);

        var aSprites = new Array();
        for(var k=2;k<50;k++){
            aSprites.push(s_oSpriteLibrary.getSprite("big_win_"+k))
        }
        
        var oData = {   // image to use
                        images: aSprites, 
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width:1385,height:669,regX:692},
                        animations: {  start: 0,anim1:[0,17,"stop_anim1"],stop_anim1:17,anim2:[18,46,"end"],end:47 }
        };
       
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oBigWin = createSprite(oSpriteSheet, "end",692,0,1385,669);
        _oBigWin.x =  CANVAS_WIDTH/2;
        _oBigWin.on("animationend",this._onAnimationEnd,this);
        _oContainer.addChild(_oBigWin);
        
        _oTextWin = new createjs.Text("","140px "+FONT_GAME_1, "#fff");
        _oTextWin.textAlign="center";
        _oTextWin.x = CANVAS_WIDTH/2;
        _oTextWin.y = CANVAS_HEIGHT/2+100;
        _oContainer.addChild(_oTextWin);
        
        _oTextWinStroke = new createjs.Text("","140px "+FONT_GAME_1, "#ffba00");
        _oTextWinStroke.textAlign="center";
        _oTextWinStroke.x = CANVAS_WIDTH/2;
        _oTextWinStroke.y = CANVAS_HEIGHT/2+100;
        _oTextWinStroke.outline = 4;
        _oContainer.addChild(_oTextWinStroke);
        
        _oRollingScore = new CRollingScore();
    };
    
    this.addEventListener = function( iEvent,cbCompleted, cbOwner ){
        _aCbCompleted[iEvent]=cbCompleted;
        _aCbOwner[iEvent] = cbOwner; 
    };
    
    this.show = function(iTotWin){
        
        
        _oContainer.visible = true;        
        _oFade.alpha = 0;
        createjs.Tween.get(_oFade).to({alpha:0.5}, 500,createjs.Ease.cubicOut).call(function(){
                                                                            _oTextWin.text = 0;
                                                                            _oTextWinStroke.text = 0;
                                                                            
                                                                            _oRollingScore.rolling(_oTextWin,_oTextWinStroke, iTotWin);
                                                                            _oBigWin.gotoAndPlay("anim1");
                                                                        });
    };
    
    this.hide = function(){
        _oContainer.visible = false;
    };
    
    this._onAnimationEnd = function(evt){
        if(evt.currentTarget.currentAnimation === "anim1"){
            setTimeout(function(){_oBigWin.gotoAndPlay("anim2");},1000);
        }else if(evt.currentTarget.currentAnimation === "anim2"){
            _oTextWin.text = "";
            _oTextWinStroke.text = "";
            if(_aCbCompleted[ON_END_BIG_WIN]){
                _aCbCompleted[ON_END_BIG_WIN].call(_aCbOwner[ON_END_BIG_WIN]);
            }
        }
    };
    
    this._init();
}