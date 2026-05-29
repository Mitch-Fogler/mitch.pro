function CBonusPanel(){
    var _bUpdate;
    var _bSpriteLoaded = false;
    var _iCurMult;
    var _iCurBet;
    var _iMaskWidth;
    var _iMaskHeight;
    var _iCurResources;
    var _iTotResources;
    var _iTotWin;
    var _iCurColumns;
    var _aPosXColumns;
    var _aBonusSeq;
    var _aButtons;
    var _oMaskPreloader;
    var _oListenerBlock;
    var _pStartPosScore;

    var _oMultAmountText;
    var _oContainerScore;
    var _oBg;
    var _oBgLoading;
    var _oZeus;
    var _oLoadingText;
    var _oProgressBar;
    var _oResultPanel;
    var _oThunder;
    var _oScoreText = null;
    var _oCloudController;
    var _oContainerButtons;
    var _oBlock;
    var _oContainer;
    
    this._init = function(){
        _bUpdate = false;
        _bSpriteLoaded = true;

        _aPosXColumns = [504,808,1112,1416];
        _oContainer.removeAllChildren();
        _oContainer.visible = false;
        
        var oSpriteBg = s_oSpriteLibrary.getSprite('bg_bonus');
        _oBg = createBitmap(oSpriteBg);
        _oContainer.addChild(_oBg);

        var aSprites = new Array();
        for(var j=0;j<101;j++){
            aSprites.push(s_oSpriteLibrary.getSprite("zeus_animations_"+j));
        }
        var oData = {   
                        images: aSprites,
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width: 490, height: 750,regX:245,regY:375}, 
                        animations: {start:0,idle:[0,60],punch:[61,100,"idle"]}
                   };
                   
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oZeus = createSprite(oSpriteSheet, "start",245,375,490,750);
        _oZeus.on("animationend",this._onZeusAnimationEnd,this);
        _oZeus.x = CANVAS_WIDTH/2;
        _oZeus.y = 388;
        _oContainer.addChild(_oZeus);

        _oContainerButtons = new createjs.Container();
        _oContainer.addChild(_oContainerButtons);
        
        var aSprites = new Array();
        for(var t=0;t<32;t++){
            aSprites.push(s_oSpriteLibrary.getSprite("thunderbolt_"+t))
        }
        var oData = {   
                        images: aSprites,
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width: 240, height: 902,regX:120,regY:902}, 
                        animations: {start:0,anim:[0,31,"end"],end:32}
                   };
                   
        var oSpriteSheet = new createjs.SpriteSheet(oData);
        _oThunder = createSprite(oSpriteSheet, "start",120,902,240,902);
        _oThunder.visible = false;
        _oContainer.addChild(_oThunder);
        
        _oCloudController = new CBonusCloud(_oContainer);
        
        var oSpriteScoreBg = s_oSpriteLibrary.getSprite("amount_bonus_win");
        _pStartPosScore = {x:14,y:CANVAS_HEIGHT - oSpriteScoreBg.height-20};
        _oContainerScore = new createjs.Container();
        _oContainerScore.x = _pStartPosScore.x;
        _oContainerScore.y = _pStartPosScore.y;
        _oContainer.addChild(_oContainerScore);
        
        
        var oBgScore = createBitmap(oSpriteScoreBg);
        _oContainerScore.addChild(oBgScore);
        
        _oMultAmountText = new createjs.Text(formatEntries(0),"56px "+FONT_GAME_1, "#ffba00");
        _oMultAmountText.textAlign="center";
        _oMultAmountText.x = oSpriteScoreBg.width/2;
        _oMultAmountText.y = 28;
        _oMultAmountText.shadow = new createjs.Shadow("#000", 2, 2, 2);
        _oContainerScore.addChild(_oMultAmountText);
        
        _oBlock = new createjs.Shape();
        _oBlock.graphics.beginFill("rgba(0,0,0,0.01)").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        _oListenerBlock = _oBlock.on("click",function(){});
        _oContainer.addChild(_oBlock);
        
        this._startBonus();
    };
    
    this._loadAllResources = function(){

        _oContainer = new createjs.Container();
        s_oAttachSection.addChild(_oContainer);

        var oSprite = s_oSpriteLibrary.getSprite('bg_loading_bonus');
        _oBgLoading = createBitmap(oSprite);
        _oContainer.addChild(_oBgLoading);
        
        var oSprite = s_oSpriteLibrary.getSprite('progress_bar');
       _oProgressBar  = createBitmap(oSprite);
       _oProgressBar.x = CANVAS_WIDTH/2 - (oSprite.width/2);
       _oProgressBar.y = CANVAS_HEIGHT - 182;
       _oContainer.addChild(_oProgressBar);
       
       _iMaskWidth = oSprite.width;
       _iMaskHeight = oSprite.height;
       _oMaskPreloader = new createjs.Shape();
       _oMaskPreloader.graphics.beginFill("rgba(255,255,255,0.01)").drawRect(_oProgressBar.x, _oProgressBar.y, 1,_iMaskHeight);
       _oContainer.addChild(_oMaskPreloader);
       
       _oProgressBar.mask = _oMaskPreloader;
       
        _oLoadingText = new createjs.Text("","30px "+FONT_GAME_1, "#ffba00");
        _oLoadingText.x = CANVAS_WIDTH/2;
        _oLoadingText.y = CANVAS_HEIGHT - 200;
        _oLoadingText.shadow = new createjs.Shadow("#000", 2, 2, 2);
        _oLoadingText.textBaseline = "alphabetic";
        _oLoadingText.textAlign = "center";
        _oContainer.addChild(_oLoadingText);

        s_oSpriteLibrary.init( this._onResourceBonusLoaded,this._onAllImagesLoaded, this );
        
        //LOAD BONUS SPRITES
        s_oSpriteLibrary.addSprite("bg_bonus","./sprites/bonus/bg_bonus.jpg");
        s_oSpriteLibrary.addSprite("clouds","./sprites/bonus/clouds.png");
        s_oSpriteLibrary.addSprite("jar","./sprites/bonus/jar.png");
        for(var k=0;k<30;k++){
            s_oSpriteLibrary.addSprite("jar_anim_"+k,"./sprites/bonus/jar_anim/jar_anim_"+k+".png");
        }
        
        for(var i=0;i<32;i++){
            s_oSpriteLibrary.addSprite("thunderbolt_"+i,"./sprites/bonus/thunderbolt/thunderbolt_"+i+".png");
        }
        
        
        s_oSpriteLibrary.addSprite("column_0","./sprites/bonus/column_0.png");
        s_oSpriteLibrary.addSprite("column_1","./sprites/bonus/column_1.png");
        s_oSpriteLibrary.addSprite("column_2","./sprites/bonus/column_2.png");
        s_oSpriteLibrary.addSprite("column_3","./sprites/bonus/column_3.png");
        for(var j=0;j<101;j++){
            s_oSpriteLibrary.addSprite("zeus_animations_"+j,"./sprites/bonus/zeus_animations/zeus_animations_"+j+".png");
        }
        
        
        _iCurResources = 0;
       
        _iTotResources = s_oSpriteLibrary.getNumSprites() ;
        if(_iTotResources === 0){
            this._startBonus();
        }else{
            s_oSpriteLibrary.loadSprites();
        }
    };
    
    // CALLBACK FOR LOADED RESOURCES
    this._onResourceBonusLoaded = function(){
        _iCurResources++;
        var iPerc = Math.floor(_iCurResources/_iTotResources *100);
        _oLoadingText.text = iPerc+"%";
        _oMaskPreloader.graphics.clear();
        var iNewMaskWidth = Math.floor((iPerc*_iMaskWidth)/100);
        _oMaskPreloader.graphics.beginFill("rgba(255,255,255,0.01)").drawRect(_oProgressBar.x, _oProgressBar.y, iNewMaskWidth,_iMaskHeight);
        
        if(_iCurResources === _iTotResources){
           this._init();
        }
    };

    
    this.unload = function(){
        _oBlock.off("click",_oListenerBlock);
        for(var i=0;i<_aButtons.length;i++){
            _aButtons[i].unload();
        }
    };
    
    this._onAllImagesLoaded = function(){
    };
    
    this.reset = function(){
        
        _oMultAmountText.text = formatEntries(0);
        
        createjs.Tween.removeTweens(_oZeus); 
        _oZeus.y = 388;
        
        if(_oScoreText !== null){
            _oScoreText.unload();
            _oScoreText = null;
        }
    };
    
    this.refreshButtonPos = function(){
        if(_oContainerScore !== undefined){
            _oContainerScore.x = _pStartPosScore.x + s_iOffsetX;
            _oContainerScore.y = _pStartPosScore.y - s_iOffsetY;
        }
    };
    
    this.show = function(aBonusSeq,iCurBet){
        _iCurBet = iCurBet;
        _aBonusSeq = aBonusSeq;

 
        
        if(_bSpriteLoaded){
            this._startBonus();
        }else{
            this._loadAllResources();
        }
    };
    
    this.hide = function(){
        _bUpdate = false;
        stop("bonus_soundtrack");
        
        _oBg.off("click",function(){});
        _oContainer.visible = false;

        this.reset();
        s_oGame.exitFromBonus(_iTotWin);

    };
    
    this._startBonus = function(){
        this.refreshButtonPos();
        
        _iTotWin = 0;
        
        _aButtons = new Array();
        this._initColumsButtons();
        
        _oZeus.gotoAndPlay("idle");

        createjs.Tween.get(_oZeus,{loop:true,bounce:true}).to({y:336}, 4000,createjs.Ease.sineInOut);
        
        _oBg.on("click",function(){});
        _oContainer.visible = true;
        _bUpdate = true;
        
        playSound("bonus_soundtrack",1,true);
    };
    
    this.endBonus = function(){
        _oResultPanel = new CBonusResultPanel(_iTotWin,_oContainer);
        

        playSound("bonus_end",1,false);
    };
    
    this._initColumsButtons = function(){
        if(_aBonusSeq.length === 0){
            this.endBonus();
        }else{
            _oThunder.visible = false;
            _aButtons = new Array();        
            _iCurMult = _aBonusSeq.shift();
            _iTotWin += _iCurMult//*_iCurBet;
            
            for(var i=0;i<4;i++){
                var oButton = new CBonusBut(i,_aPosXColumns[i],CANVAS_HEIGHT,_oContainerButtons);
                oButton.addEventListener(ON_MOUSE_UP,this._onButtonRelease,this);
                if(i === 0 || i === 3){
                    oButton.setScale(0.86);
                }
                
                _aButtons.push(oButton);
            }

            s_oBonusPanel._showAllButtons();
        }
    };
    
    this._showAllButtons = function(){
        _oBlock.visible = false;
        var iTime = 500;
        var aY = [380,528,528,380];
        for(var i=0;i<_aButtons.length;i++){
            _aButtons[i].tweenDown(aY[i],iTime);
            
            iTime += 200;
        }
    };
    
    this._disableAllButtons = function(){
        _oBlock.visible = true;
    };
    
    this.refreshScoreAmount = function(){
        _oMultAmountText.text = formatEntries(_iTotWin);
    };
    
    this._onButtonRelease = function(iIndex){
        s_oBonusPanel._disableAllButtons();
        
        _iCurColumns = iIndex;
        _oZeus.gotoAndPlay("punch");
        playSound("bonus_zeus_punch",1,false);
        
        for(var i=0;i<_aButtons.length;i++){
            if(_iCurColumns !== i){
                _aButtons[i].tweenUp(CANVAS_HEIGHT,500);
            }
        }
    };
    
    this._onZeusAnimationEnd = function(evt){
        if(evt.currentTarget.currentAnimation === "punch"){
            _oThunder.x = _aButtons[_iCurColumns].getX();
            
            _oThunder.visible = true;
            _oThunder.gotoAndPlay("anim");
            playSound("thunder",1,false);
            
            if(_iCurColumns ===0 || _iCurColumns ===3){
                _oThunder.y = _aButtons[_iCurColumns].getY() + 248;
                _oThunder.scaleX = _oThunder.scaleY = 0.86;
            }else{
                _oThunder.y = _aButtons[_iCurColumns].getY() + 294;
                _oThunder.scaleX = _oThunder.scaleY = 1;
            }
            
            this._destroyJar();
        }
    };
    
    this._destroyJar = function(){
        _aButtons[_iCurColumns].explode();
        
        _oScoreText = new CScoreText(formatEntries(_iCurMult/**_iCurBet*/),_aButtons[_iCurColumns].getX(),_aButtons[_iCurColumns].getY(),_oContainer);
        this.refreshScoreAmount();
        
        setTimeout(function(){_aButtons[_iCurColumns].tweenUp(CANVAS_HEIGHT,500);},1500);
        setTimeout(function(){s_oBonusPanel._initColumsButtons();},2000);
    };

    
    this.update = function(){
	if(_bUpdate){
            _oCloudController.update();
        }
    };
    
    s_oBonusPanel = this;
}


var s_oBonusPanel = null;