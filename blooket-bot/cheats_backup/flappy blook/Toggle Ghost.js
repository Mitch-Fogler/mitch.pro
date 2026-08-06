(async () =>  {
    Object.values(document.querySelector("#phaser-bouncy"))[0].return.updateQueue.lastEffect.deps[0].current.config.sceneConfig.physics.world.bodies.entries.forEach(e=> {
        e.gameObject.frame.texture.key.startsWith("blook")&&(e.checkCollision.none=1==e.gameObject.alpha, e.gameObject.setAlpha(1==e.gameObject.alpha?.5:1))
        }
        )
    }
    )();