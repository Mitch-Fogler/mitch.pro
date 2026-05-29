function CAreYouSurePanel() {
    var _aCbCompleted;
    var _aCbOwner;
    var _oListenerBlock;
    
    var _oBg;
    var _oMsg;
    var _oButYes;
    var _oButNo;
    var _oContainerPanel;
    var _oContainer;
    var _oFade;
    
    var _oThis = this;

    this._init = function () {
        _aCbCompleted = new Array();
        _aCbOwner = new Array();
        
        _oContainer = new createjs.Container();
        _oContainer.visible = false;
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
        
        
        _oBg = createBitmap(oSpriteBg);
        _oContainerPanel.addChild(_oBg);

        _oMsg = new CTLText(_oContainerPanel, 
                    50, 60, oSpriteBg.width-100, 180, 
                    90, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_ARE_SURE,
                    true, true, true,
                    false );
        
        

        _oButYes = new CGfxButton( oSpriteBg.width - 130,  380, s_oSpriteLibrary.getSprite('but_yes'), _oContainerPanel);
        _oButYes.addEventListener(ON_MOUSE_UP, this._onButYes, this);

        _oButNo = new CGfxButton( 130,  380, s_oSpriteLibrary.getSprite('but_no'), _oContainerPanel);
        _oButNo.addEventListener(ON_MOUSE_UP, this._onButNo, this);
        
        this.disableButtons();
    };
    
    this.addEventListener = function (iEvent, cbCompleted, cbOwner) {
        _aCbCompleted[iEvent] = cbCompleted;
        _aCbOwner[iEvent] = cbOwner;
    };
    
    this.disableButtons = function(){
        _oButYes.disable();
        _oButNo.disable();
    };
    
    this.enableButtons = function(){
        _oButNo.enable();
        _oButYes.enable();
    };
    
    this.show = function (szMsg) {
        _oMsg.refreshText( szMsg);

        _oContainer.visible = true;
        _oContainerPanel.scale = 0;
        _oFade.alpha = 0;
        createjs.Tween.get(_oFade).to({alpha: 0.7}, 300, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale:1}, 1000, createjs.Ease.elasticOut).call(function(){
                                s_oMain.stopUpdateNoBlock();
                                _oThis.enableButtons();
                            });
    };
    
    this.hide = function(bExit){
        s_oMain.startUpdateNoBlock();
        
        createjs.Tween.get(_oFade).to({alpha: 0}, 500, createjs.Ease.quartOut)
        createjs.Tween.get(_oContainerPanel).to({scale: 0}, 500, createjs.Ease.backIn).call(function(){
            _oContainer.visible = false;
            if(bExit){
                if (_aCbCompleted[ON_BUT_YES_DOWN]) {
                    _aCbCompleted[ON_BUT_YES_DOWN].call(_aCbOwner[ON_BUT_YES_DOWN]);
                }
            }
        });
    };

    this.unload = function () {
        _oButNo.unload();
        _oButYes.unload();
        _oFade.off("click",_oListenerBlock);
    };

    this._onButYes = function () {
        _oThis.disableButtons();
        _oThis.hide(true);
    };

    this._onButNo = function(){    
        _oThis.disableButtons();
        _oThis.hide(false);
    };

    this._init();
}