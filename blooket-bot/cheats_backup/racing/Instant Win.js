(async () =>  {
    var t=Object.values(function t(e=document.querySelector("body>div")) {
        return Object.values(e)[1]?.children?.[0]?._owner.stateNode?e:t(e.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner["stateNode"];
        t.setState( {
            progress:t.state.goalAmount
            }
            ), t.props.liveGameController.setVal( {
                path:"c/"+t.props.client.name+"/pr", val:t.state.goalAmount
                }
                )
            }
            )();