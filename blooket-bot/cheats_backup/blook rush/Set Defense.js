(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.prompt=window.prompt, e.remove(), Object.values(function e(t=document.querySelector("body>div")) {
        return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner)["stateNode"], t=Math.min(parseInt(prompt("How much defense do you want? (Max 4)"))||0, 4);
        e.setState( {
            numDefense:t
            }
            ), e.props.liveGameController.setVal( {
                path:(e.isTeam?"a/":"c/")+e.props.client.name+"/d", val:t
                }
                )
            }
            )();