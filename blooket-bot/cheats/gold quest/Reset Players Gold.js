(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.prompt=window.prompt, e.remove(), Object.values(function e(t=document.querySelector("body>div")) {
        return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner)["stateNode"];
        e.props.liveGameController.setVal( {
            path:"c/"+e.props.client.name+"/tat", val:prompt("Who's gold would you like to reset? (Case sensitive)")+":swap:0"
            }
            )
        }
        )();