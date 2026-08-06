(async () =>  {
    var o=Object.values(function t(e=document.querySelector("body>div")) {
        return Object.values(e)[1]?.children?.[0]?._owner.stateNode?e:t(e.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner.stateNode.game.current.config.sceneConfig.physics.world.colliders._active.filter(t=>t.callbackContext?.toString?.()?.includes?.("dmgCd"));
        for(let e=0;
        e<o.length;
        e++) {
            var n=o[e].object2;
            let t=n.classType.prototype.start;
            n.classType.prototype.start=function() {
                t.apply(this, arguments), this.hp=1
                }
                , n.children.entries.forEach(t=>t.hp=1)
                }
            }
            )();