function CPayTablePanel(){
    var _iCurPage;
    var _aNumSymbolComboText;
    var _aWinComboText;
    var _aPages;

    var _oCurPage;
    
    var _oButExit;
    var _oButArrowNext;
    var _oButArrowPrev;
    var _oContainer;
    
    this._init = function(){
        _iCurPage = 0;
        _aPages = new Array();
        
        _oContainer = new createjs.Container();
        _oContainer.on("click",function(){});
        _oContainer.visible = false;
        s_oAttachSection.addChild(_oContainer);
        
        //ATTACH PAGE 1
        var oContainerPage = new createjs.Container();
        _oContainer.addChild(oContainerPage);
        
        var oBg = createBitmap(s_oSpriteLibrary.getSprite('paytable1'));
        oContainerPage.addChild(oBg);
        
        //LIST OF COMBO TEXT

        this._createPayouts(oContainerPage);
        
        _aPages[0] = oContainerPage;
        
        //ATTACH PAGE 2
        oContainerPage = new createjs.Container();
        oContainerPage.visible = false;
        _oContainer.addChild(oContainerPage);
        
        oBg = createBitmap(s_oSpriteLibrary.getSprite('paytable2'));
        oContainerPage.addChild(oBg);

        _aPages[1] = oContainerPage;
        
        _oCurPage = _aPages[_iCurPage];
        
        //ATTACH PAGE 3
        oContainerPage = new createjs.Container();
        oContainerPage.visible = false;
        _oContainer.addChild(oContainerPage);
        
        oBg = createBitmap(s_oSpriteLibrary.getSprite('paytable3'));
        oContainerPage.addChild(oBg);
        
        var oText = new CTLText(oContainerPage, 
                    1000, 366, 546, 118, 
                    36, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_HELP_BONUS1,
                    true, true, true,
                    false );

        
        var oText2 = new CTLText(oContainerPage, 
                    1000, 544, 546, 280, 
                    36, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_HELP_BONUS2,
                    true, true, true,
                    false );

        
        _aPages[2] = oContainerPage;
        
        //ATTACH PAGE 4
        oContainerPage = new createjs.Container();
        oContainerPage.visible = false;
        _oContainer.addChild(oContainerPage);
        
        oBg = createBitmap(s_oSpriteLibrary.getSprite('paytable4'));
        oContainerPage.addChild(oBg);
        
        var iYPos = 400;
        for(var j=0;j<3;j++){
            var oText = new createjs.Text((j+3)+"X  "+NUM_FREESPIN[j],"40px "+FONT_GAME_1, "#ffba00");
            oText.textAlign = "left";
            oText.x = CANVAS_WIDTH/2+44;
            oText.y = iYPos;
            oText.textBaseline = "alphabetic";
            oContainerPage.addChild(oText);

            iYPos += 42;
        }
        
        var oText = new CTLText(oContainerPage, 
                    CANVAS_WIDTH/2-280, 550, 560, 280, 
                    56, "center", "#ffba00", FONT_GAME_1, 1,
                    0, 0,
                    TEXT_HELP_FREESPIN,
                    true, true, true,
                    false );

        
        _aPages[3] = oContainerPage;
        
        _oCurPage = _aPages[_iCurPage];

        //ATTACH ARROW
        _oButArrowNext = new CGfxButton(CANVAS_WIDTH - 270,CANVAS_HEIGHT/2,s_oSpriteLibrary.getSprite('but_arrow_next'),_oContainer);
        _oButArrowNext.addEventListener(ON_MOUSE_UP, this._onNext, this);
        
        _oButArrowPrev = new CGfxButton(270,CANVAS_HEIGHT/2,s_oSpriteLibrary.getSprite('but_arrow_prev'),_oContainer);
        _oButArrowPrev.addEventListener(ON_MOUSE_UP, this._onPrev, this);

        var oSprite = s_oSpriteLibrary.getSprite('but_exit_info');
        _oButExit = new CGfxButton(1566, 266, oSprite, _oContainer);
        _oButExit.addEventListener(ON_MOUSE_UP, this._onExit, this);
    };
    
    this.unload = function(){
        return;
        _oContainer.off("click",function(){});
        _oButExit.unload();
        
        _oButArrowNext.unload();
        _oButArrowPrev.unload();
        
        s_oAttachSection.removeChild(_oContainer);
        
        for(var i=0;i<_aNumSymbolComboText.length;i++){
            _oContainer.removeChild(_aNumSymbolComboText[i]);
        }
        
        for(var j=0;j<_aWinComboText.length;j++){
            _oContainer.removeChild(_aWinComboText[j]);
        }
        
    };
    
    this._createPayouts = function(oContainerPage){
        _aNumSymbolComboText = new Array();
        _aWinComboText = new Array();
        
        var aPos = [{x:1164,y:744},{x:800,y:744},{x:1290,y:558},{x:940,y:558},{x:590,y:558},{x:1164,y:374},{x:800,y:374}];
        var iCurPos = 0;
        for(var i=0;i<PAYTABLE_VALUES.length;i++){
            var aSymbolPayouts = PAYTABLE_VALUES[i];
            do{
                var iIndex = aSymbolPayouts.indexOf(0);
                if(iIndex !== -1){
                    aSymbolPayouts.splice(iIndex, 1);
                }
                
            }while(iIndex !== -1);
            
            var iLen = aSymbolPayouts.length;
            
            if(iLen === 0){
                continue;
            }
            
            var iOffsetY = 40;
            if(iLen === 4){
                iOffsetY = 32;
            }
            
            var iYPos = aPos[iCurPos].y;
            _aNumSymbolComboText[i] = new Array();
            _aWinComboText[i] = new Array();

            for(var j=0;j<iLen;j++){
                var oTextMult = new createjs.Text("X"+(5-j),"40px "+FONT_GAME_1, "#ffffff");
                oTextMult.textAlign = "center";
                oTextMult.x = aPos[iCurPos].x;
                oTextMult.y = iYPos;
                oTextMult.textBaseline = "alphabetic";
                oContainerPage.addChild(oTextMult);

                _aNumSymbolComboText[i][j] = oTextMult;
                
                var oText = new createjs.Text(aSymbolPayouts[iLen-j-1],"40px "+FONT_GAME_1, "#ffba00");
                oText.textAlign = "center";
                oText.x = oTextMult.x + 70;
                oText.y = oTextMult.y;
                oText.textBaseline = "alphabetic";
                oContainerPage.addChild(oText);

                _aWinComboText[i][j] = oText;
            
                iYPos += iOffsetY;
            }
            
            iCurPos++;
        }
    };
    
    this._onNext = function(){
        if(_iCurPage === _aPages.length-1){
            _iCurPage = 0;
        }else{
            _iCurPage++;
        }
        
        
        _oCurPage.visible = false;
        _aPages[_iCurPage].visible = true;
        _oCurPage = _aPages[_iCurPage];
    };
    
    this._onPrev = function(){
        if(_iCurPage === 0){
            _iCurPage = _aPages.length -1;
        }else{
            _iCurPage--;
        }
        
        
        _oCurPage.visible = false;
        _aPages[_iCurPage].visible = true;
        _oCurPage = _aPages[_iCurPage];
    };

    
    this.refreshButtonPos = function(iNewX,iNewY){
       
    };
    
    this.show = function(){
        _iCurPage = 0;
        _oCurPage.visible = false;
        _aPages[_iCurPage].visible = true;
        _oCurPage = _aPages[_iCurPage];
        
        _oContainer.visible = true;
    };
    
    this.hide = function(){
        _oContainer.visible = false;
    };
    
    this.resetHighlightCombo = function(){
        for(var i=0;i<_aNumSymbolComboText.length;i++){
            if(_aNumSymbolComboText[i] !== undefined){
                for(var j=0;j<_aNumSymbolComboText[i].length;j++){
                    _aNumSymbolComboText[i][j].color = "#ffffff";
                    _aWinComboText[i][j].color = "#ffff00";
                    createjs.Tween.removeTweens(_aWinComboText[i][j]);
                    _aWinComboText[i][j].alpha = 1;
                }
            }
            
        } 
    };
    
    this.highlightCombo = function(iSymbolValue,iNumCombo){
        
        _aWinComboText[iSymbolValue][NUM_REELS-iNumCombo].color = "#ff9000";
        
        this.tweenAlpha(_aWinComboText[iSymbolValue][NUM_REELS-iNumCombo],0);
        
    };
    
    this.tweenAlpha = function(oText,iAlpha){
        createjs.Tween.get(oText,{loop:-1}).to({alpha:0}, 200).to({alpha:1},200);
    };
    
    this._onExit = function(){
        s_oGame.hidePayTable();
    };
    
    this.isVisible = function(){
        return _oContainer.visible;
    };
    
    this._init();
}