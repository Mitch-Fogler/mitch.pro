function CRechargePanel(){
    var _oListenerBlock;
    var _oFade;
    var _oContainerPanel;
    var _oButYes;
    var _oButNo;
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
        
        var oSpriteBg = s_oSpriteLibrary.getSprite('msg_box_small');
        
        _oContainerPanel = new createjs.Container();
        _oContainerPanel.x = CANVAS_WIDTH/2;
        _oContainerPanel.y = CANVAS_HEIGHT/2;
        _oContainerPanel.regX = oSpriteBg.width * 0.5;
        _oContainerPanel.regY = oSpriteBg.height * 0.5;
        _oContainer.addChild(_oContainerPanel);
        
        
        _oPanel = createBitmap(oSpriteBg);        
        _oContainerPanel.addChild(_oPanel);


        var oTitle = new CTLText(_oContainerPanel, 
                    50, 60, oSpriteBg.width-100, 180, 
                    90, "center", "#ffba00", FONT_GAME_1, 1,
                    40, 10,
                    TEXT_RECHARGE,
                    true, true, true,
                    false );


        var oSprite = s_oSpriteLibrary.getSprite('but_no');
        _oButNo = new CGfxButton(130, 380, oSprite, _oContainerPanel);
        _oButNo.addEventListener(ON_MOUSE_UP, this.hide, this);
        
        _oButYes = new CGfxButton(oSpriteBg.width - 130, 380, s_oSpriteLibrary.getSprite('but_yes'), _oContainerPanel);
        _oButYes.addEventListener(ON_MOUSE_UP, this._onRecharge, this);
        
        this.disableButtons();
       
        _oContainer.visible = true;
        _oContainerPanel.scale = 0;
        _oFade.alpha = 0;
        createjs.Tween.get(_oFade).to({alpha: 0.7}, 300, createjs.Ease.quartOut);
        createjs.Tween.get(_oContainerPanel).to({scale:1}, 1000, createjs.Ease.elasticOut).call(function(){
                                _oThis.enableButtons();
                            });
    };
    
    this.unload = function(){
        _oButNo.unload();
        _oButYes.unload();
        _oFade.off("click",_oListenerBlock);
        
        s_oStage.removeChild(_oContainer);

    };
    
    this.disableButtons = function(){
        _oButYes.disable();
        _oButNo.disable();
    };
    
    this.enableButtons = function(){
        _oButNo.enable();
        _oButYes.enable();
    };
    
    this.hide = function(){
        var oParent = this;
        
        createjs.Tween.get(_oFade).to({alpha: 0}, 500, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale: 0}, 500, createjs.Ease.backIn).call(function(){
             oParent.unload();
        });
    };
    
    this._onRecharge = function(){
        _oThis.hide();
        $(s_oMain).trigger("recharge");
    };
    
    this._init();
    
    
};


