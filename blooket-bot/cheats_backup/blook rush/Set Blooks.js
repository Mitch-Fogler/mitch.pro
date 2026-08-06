(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.prompt=window.prompt, e.remove(), Object.values(function e(t=document.querySelector("body>div")) {
        return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner)["stateNode"], t=parseInt(prompt("How many blooks do you want?"))||0;
        e.setState( {
            numBlooks:t
            }
            ), e.props.liveGameController.setVal( {
                path:(e.isTeam?"a/":"c/")+e.props.client.name+"/bs", val:t
                }
                )
            }
            )();