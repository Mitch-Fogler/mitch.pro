function CMsgBox(){
    var _oListenerBlock;
    var _oBlock;
    var _oBg;
    var _oMsgText;
    var _oButExit;
    var _oContainerPanel;
    var _oGroup;
    
    this._init = function(){
        _oGroup = new createjs.Container();
        _oGroup.visible = false;
        s_oStage.addChild(_oGroup);
        
        _oBlock = new createjs.Shape();
        _oBlock.graphics.beginFill("rgba(0,0,0,0.7)").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        _oListenerBlock = _oBlock.on("click",function(){});
        _oGroup.addChild(_oBlock);
        
        var oSpriteBg = s_oSpriteLibrary.getSprite('msg_box');
        
        _oContainerPanel = new createjs.Container();
        _oContainerPanel.x = CANVAS_WIDTH/2;
        _oContainerPanel.y = CANVAS_HEIGHT/2; 
        _oContainerPanel.regX = oSpriteBg.width/2;
        _oContainerPanel.regY = oSpriteBg.height/2;
        _oContainerPanel.scale = 0;
        _oGroup.addChild(_oContainerPanel);
        
        _oBg = createBitmap(oSpriteBg);
        _oContainerPanel.addChild(_oBg);


        _oMsgText =  new CTLText(_oContainerPanel, 
                    70, 60, oSpriteBg.width-140, 400, 
                    42, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    " ",
                    true, true, true,
                    false );
         
                                                      
        _oButExit = new CGfxButton(oSpriteBg.width/2 ,oSpriteBg.height - 150,s_oSpriteLibrary.getSprite('but_yes'),_oContainerPanel);
        _oButExit.addEventListener(ON_MOUSE_UP, this._onExit, this); 
    };
    
    this.unload = function(){
        _oBlock.off("click",_oListenerBlock);
        _oButExit.unload();
    };
    
    this.show = function(szMsg){
        _oMsgText.refreshText(szMsg);
        _oGroup.visible = true;
        _oBlock.alpha = 0;
        
        var oParent = this;
        createjs.Tween.get(_oBlock).to({alpha: 0.7}, 300, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale:1}, 1000, createjs.Ease.elasticOut);
    };
    
    this.hide = function(){
        _oButExit.disable();
        
        createjs.Tween.get(_oBlock).to({alpha: 0}, 500, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale: 0}, 500, createjs.Ease.backIn).call(function(){
            _oGroup.visible = false;
        });
    }
    
    this._onExit = function(){
        this.hide();
    };
    
    this._init();

}