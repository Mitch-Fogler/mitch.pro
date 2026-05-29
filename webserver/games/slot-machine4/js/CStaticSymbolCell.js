function CStaticSymbolCell(iRow,iCol,iXPos,iYPos){
    var _iNumCycles;
    var _iTotAnimCycle;
    var _iRow;
    var _iCol;
    var _iStartX;
    var _iStartY;
    var _iCurSpriteAnimating = -1;
    var _iLastAnimFrame;
    var _aSprites;
    var _oWinningFrame;
    var _oWinningFrameBig;
    var _oAmountText;

    var _oAmountBg;
    var _oImageAttach;
    var _oContainer;
    var _oThis;
    
    this._init = function(iRow,iCol,iXPos,iYPos){
        _iRow = iRow;
        _iCol = iCol;
        _iStartX = iXPos;
        _iStartY = iYPos;
        _iNumCycles = 0;
        
        _oContainer = new createjs.Container();
        _oContainer.visible = false;
        s_oAttachSection.addChild(_oContainer);
        
        _oImageAttach = new createjs.Container();
        _oImageAttach.visible = false;
        _oImageAttach.x = iXPos;
        _oImageAttach.y = iYPos;
        
        _oContainer.addChild(_oImageAttach);
        _oImageAttach.scaleX = _oImageAttach.scaleY = 0.5 * REEL_SCALE;
        var oParent= this;
        _aSprites = new Array();
        for(var i=0;i<NUM_SYMBOLS;i++){
                var oSprite = createSprite(s_aSymbolAnims[i], "static",0,0,SYMBOL_ANIM_WIDTH,SYMBOL_ANIM_HEIGHT);
                oSprite.on("animationend", oParent._onAnimEnded, null, false);
                _oImageAttach.addChild(oSprite);

                _aSprites[i] = oSprite;
                _aSprites[i].visible = false;
        }
        
        
        var oData = {   // image to use
                        images: [s_oSpriteLibrary.getSprite('win_frame_anim_big_0'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_1'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_2'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_3'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_4'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_5'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_6'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_big_7')], 
                        framerate:60,
                        // width, height & registration point of each sprite
                        frames: {width: WIN_BIG_ANIM_WIDTH, height: WIN_BIG_ANIM_HEIGHT}, 
                        animations: {  static: 0,anim:[1,64] }
        };

        var oSpriteSheet = new createjs.SpriteSheet(oData);
        
        _oWinningFrameBig = createSprite(oSpriteSheet, "static",0,0,WIN_BIG_ANIM_WIDTH,WIN_BIG_ANIM_HEIGHT);
        _oWinningFrameBig.x = -36;
        _oWinningFrameBig.y = -32;
        _oImageAttach.addChild(_oWinningFrameBig);
        
        
        var oSpriteAmount = s_oSpriteLibrary.getSprite("amount_bonus_win");
        _oAmountBg = createBitmap(oSpriteAmount);
        _oAmountBg.regX = oSpriteAmount.width/2;
        _oAmountBg.regY = oSpriteAmount.height/2;
        _oAmountBg.x = SYMBOL_ANIM_WIDTH/2;
        _oAmountBg.y = SYMBOL_ANIM_HEIGHT;
        _oImageAttach.addChild(_oAmountBg);

        
        _oAmountText = new CTLText(_oImageAttach, 
                    SYMBOL_ANIM_WIDTH/2 - 125, SYMBOL_ANIM_HEIGHT - 37, 250, 76, 
                    76, "center", "#ffba00", FONT_GAME_1, 1.1,
                    0, 0,
                    " ",
                    true, true, false,
                    false );

        
        var oData = {   // image to use
                        images: [s_oSpriteLibrary.getSprite('win_frame_anim_0'),
                                s_oSpriteLibrary.getSprite('win_frame_anim_1')], 
                        framerate:40,
                        // width, height & registration point of each sprite
                        frames: {width: 342, height: 336}, 
                        animations: {  static: 0,anim:[0,42] }
        };

        var oSpriteSheet = new createjs.SpriteSheet(oData);
        
        _oWinningFrame = createSprite(oSpriteSheet, "static",0,0,342,336);
        _oWinningFrame.x = iXPos-60;
        _oWinningFrame.y = iYPos-60;
        _oWinningFrame.scaleX = _oWinningFrame.scaleY = REEL_SCALE;
        _oContainer.addChild(_oWinningFrame);
    };
    
    this.unload = function(){
        s_oAttachSection.removeChild(_oContainer);
    };
    
    this.hide = function(){
         if(_iCurSpriteAnimating > -1){
            stopSound("symbol"+_iCurSpriteAnimating);

            _oWinningFrame.gotoAndStop("static"); 
            _oWinningFrame.visible = false;
            _oWinningFrameBig.gotoAndStop("static"); 
            _oWinningFrameBig.visible = false;
            _oAmountBg.visible = false;
            _oAmountText.refreshText(" ");
 
            _aSprites[_iCurSpriteAnimating].gotoAndPlay("static");
            _aSprites[_iCurSpriteAnimating].visible = false;
            _oContainer.visible = false;
            _iCurSpriteAnimating = -1;
        }
    };
    
    this.show = function(iValue,iAmountWin,oPos,oRegPoint,iAnimCycle){
        _iNumCycles = 0;
        _iTotAnimCycle = iAnimCycle;

        for(var i=0;i<NUM_SYMBOLS;i++){
            if( (i+1) === iValue){
                _aSprites[i].visible = true;
            }else{
                _aSprites[i].visible = false;
            }
        }
        _oAmountBg.visible = false;
       
        if(iAmountWin > 0){
            _oAmountText.refreshText(formatEntries(iAmountWin));
    
            _oAmountBg.visible = true;
        }else{
            _oAmountText.refreshText(" ");
        }
        
        _oWinningFrameBig.gotoAndPlay("anim");
        _oWinningFrameBig.visible = true;
        
        _aSprites[iValue-1].gotoAndPlay("anim");
        _iCurSpriteAnimating = iValue-1;

        _iLastAnimFrame = _aSprites[iValue-1].spriteSheet.getNumFrames();
        _oImageAttach.regX = oRegPoint.x;
        _oImageAttach.regY = oRegPoint.y;
        _oImageAttach.x = _iStartX + oPos.x;
        _oImageAttach.y = _iStartY + oPos.y;
        _oImageAttach.scaleX = _oImageAttach.scaleY = 0.5*REEL_SCALE;
        _oImageAttach.visible = true;
        _oImageAttach.alpha = 1;
        _oContainer.visible= true;
        
        createjs.Tween.get(_oImageAttach).to({scaleX:REEL_SCALE,scaleY:REEL_SCALE }, 1000,createjs.Ease.cubicOut);

        playSound("symbol"+_iCurSpriteAnimating,1,false);
        
        
    };
    
    this.showWinFrame = function(){
        _oWinningFrame.gotoAndPlay("anim");
        _oWinningFrame.visible = true;
        _oContainer.visible = true;
    };
    
    this.hideWinFrame = function(){
         createjs.Tween.removeTweens(_oImageAttach);
                 
        _oWinningFrame.gotoAndPlay("static");
        _oWinningFrame.visible = false;
        _oContainer.visible = false;
    };
    
    this._onAnimEnded = function(){
        _iNumCycles++;
        if(_iNumCycles === _iTotAnimCycle && _iCurSpriteAnimating > -1){
            //END WHOLE SYMBOL ANIMATION
            _aSprites[_iCurSpriteAnimating].stop();
            createjs.Tween.get(_oImageAttach).to({scaleX:0.52,scaleY:0.52 ,alpha:0}, 500,createjs.Ease.cubicOut).call(function(){_oThis.stopAnim();s_oGame.showWin();});
        }
    };
    
    this.stopAnim = function(){
        if( _iCurSpriteAnimating === -1 ){
            return;
        }

        stopSound("symbol"+_iCurSpriteAnimating);
        
       
       _aSprites[_iCurSpriteAnimating].visible = false;
       _oImageAttach.visible = false;
       
       _oWinningFrame.gotoAndStop("static");
       _oWinningFrame.visible = false;
    };
    
    _oThis = this;
    this._init(iRow,iCol,iXPos,iYPos);
}