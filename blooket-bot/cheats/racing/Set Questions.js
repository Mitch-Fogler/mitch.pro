(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.prompt=window.prompt, window.alert=window.alert, e.remove(), Object.values(function e(t=document.querySelector("body>div")) {
        return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner)["stateNode"], t=e.props.client.amount-(parseInt(prompt("How many questions left do you want?"))||0);
        isNaN(t)||t<0?alert("Invalid amount"):(e.setState( {
            progress:t
            }
            ), e.props.liveGameController.setVal( {
                path:"c/"+e.props.client.name+"/pr", val:t
                }
                ))
            }
            )();