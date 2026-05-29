function CCreditsPanel(){
    var _oListenerLogo;
    var _oListenerBlock;
    var _oFade;
    var _oContainerPanel;
    var _oButExit;
    var _oLogo;
    var _oPanel;
    var _oContainer;
    var _pStartPanelPos;
    
    var _oThis = this;
    
    this._init = function(){
        
        _oContainer = new createjs.Container();
        s_oStage.addChild(_oContainer);
        
        _oFade = new createjs.Shape();
        _oListenerBlock = _oFade.on("click",function(){});
        _oFade.alpha = 0;
        _oFade.graphics.beginFill("black").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        _oContainer.addChild(_oFade);
        
        _oContainerPanel = new createjs.Container();
        _oContainer.addChild(_oContainerPanel);
        
        var oSprite = s_oSpriteLibrary.getSprite('msg_box');
        _oPanel = createBitmap(oSprite);        
        _oPanel.regX = oSprite.width/2;
        _oPanel.regY = oSprite.height/2;
        _oContainerPanel.addChild(_oPanel);
        _oListenerLogo = _oPanel.on("click",this._onLogoButRelease);
        
        _oContainerPanel.x = CANVAS_WIDTH/2;
        _oContainerPanel.y = CANVAS_HEIGHT/2;  
        _pStartPanelPos = {x: _oContainerPanel.x, y: _oContainerPanel.y};


        var oLink = new createjs.Text("www.codethislab.com","52px "+FONT_GAME_1, "#ffba00");
        oLink.y = 40;
        oLink.textAlign = "center";
        oLink.textBaseline = "alphabetic";
        oLink.lineWidth = 300;
        _oContainerPanel.addChild(oLink);
        
        var oSprite = s_oSpriteLibrary.getSprite('ctl_logo');
        _oLogo = createBitmap(oSprite);
        _oLogo.y = -150;
        _oLogo.regX = oSprite.width/2;
        _oLogo.regY = oSprite.height/2;
        _oContainerPanel.addChild(_oLogo);
      
        var oSprite = s_oSpriteLibrary.getSprite('but_yes');
        _oButExit = new CGfxButton(0, 200, oSprite, _oContainerPanel);
        _oButExit.addEventListener(ON_MOUSE_UP, this.hide, this);
        
        _oContainerPanel.scale = 0;
        _oFade.alpha = 0;
        createjs.Tween.get(_oFade).to({alpha: 0.7}, 300, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale:1}, 1000, createjs.Ease.elasticOut);
    };
    
    this.unload = function(){
        createjs.Tween.get(_oContainer).to({alpha:0},500).call(function(){
            s_oStage.removeChild(_oContainer);

            _oButExit.unload();
        }); 
        
        _oFade.off("click",_oListenerBlock);
        _oPanel.off("click",_oListenerLogo);  
    };
    
    this._onLogoButRelease = function(){
        
        window.open("http://www.codethislab.com/index.php?&l=en");
    };
    
    this.hide = function(){
        _oButExit.disable();
        createjs.Tween.get(_oFade).to({alpha: 0}, 500, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale: 0}, 500, createjs.Ease.backIn).call(function(){
            _oThis.unload();
        });
    }
    
    this._init();
    
    
};


