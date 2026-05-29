var MS_ROLLING_SCORE = 2500;
function CRollingScore() {

    var _oTweenText = null;
    var _oTweenTextStroke = null;

    this.rolling = function (oScoreText, oScoreTextStruct, iScore) {

        _oTweenText = createjs.Tween.get(oScoreText, {override: true}).to({text: iScore}, MS_ROLLING_SCORE, createjs.Ease.linear).addEventListener("change", function () {
            oScoreText.text = formatEntries(oScoreText.text);
            playSound("score_counter",0.5,false);
        }).call(function () {
            createjs.Tween.removeTweens(_oTweenText);
        });

        if (oScoreTextStruct !== null) {
            _oTweenTextStroke = createjs.Tween.get(oScoreTextStruct, {override: true}).to({text: iScore}, MS_ROLLING_SCORE, createjs.Ease.linear).addEventListener("change", function () {
                oScoreTextStruct.text = formatEntries(oScoreTextStruct.text);
            }).call(function () {
                createjs.Tween.removeTweens(_oTweenTextStroke);
            });

        }
    };

    return this;
}