function CBonusResultPanel(iPrize, oParentContainer){
    var _oContainer;
    var _oContainerPanel;
    var _oParentContainer = oParentContainer;
    
    this._init = function(iPrize){
       _oContainer = new createjs.Container();
        _oParentContainer.addChild(_oContainer);
        
        var oSpriteBg = s_oSpriteLibrary.getSprite("msg_box_small");
        
        _oContainerPanel = new createjs.Container();
        _oContainerPanel.x = CANVAS_WIDTH/2;
        _oContainerPanel.y = CANVAS_HEIGHT/2; 
        _oContainerPanel.regX = oSpriteBg.width/2;
        _oContainerPanel.regY = oSpriteBg.height/2;
        _oContainerPanel.scale = 0;
        _oContainer.addChild(_oContainerPanel);
        
        var oBg = createBitmap(oSpriteBg);
        _oContainerPanel.addChild(oBg);
        
        var oCongratsText = new CTLText(_oContainerPanel, 
                    50, 60, oSpriteBg.width-100, 74, 
                    74, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_CONGRATS,
                    true, true, false,
                    false );

        
        var oWonText = new CTLText(_oContainerPanel, 
                    50, 150, oSpriteBg.width-100, 280, 
                    70, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_YOU_WIN+"\n"+formatEntries(iPrize),
                    true, true, true,
                    false );
                    

        
        var oParent = this;
        createjs.Tween.get(_oContainerPanel).to({scale:1}, 1000, createjs.Ease.elasticOut).call(function(){
                                                                                                setTimeout(function(){
                                                                                                    oParent.hide(); 
                                                                                                },3000);
                                                                                    });
                                                                                                                                    
    };

    
    this.hide = function(){
        createjs.Tween.get(_oContainerPanel).to({scale: 0}, 500, createjs.Ease.backIn).call(function(){
            _oParentContainer.removeChild(_oContainer);
            s_oBonusPanel.hide();
        });
    };

    this._init(iPrize);
}