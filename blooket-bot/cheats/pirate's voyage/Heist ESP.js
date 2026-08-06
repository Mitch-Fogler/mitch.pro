(async () =>  {
    var e=document.createElement("iframe"), e=(document.body.append(e), window.alert=window.alert, e.remove(), Object.values(function e(t=document.querySelector("body>div")) {
        return Object.values(t)[1]?.children?.[0]?._owner.stateNode?t:e(t.querySelector(":scope>div"))
        }
        ())[1].children[0]._owner)["stateNode"];
        if("heist"==e.state.stage) {
            const r=Array.prototype.map.call(Array.prototype.slice.call(document.querySelector("[class*=prizesList]").children, 1, 4), e=>e.querySelector("img").src), c=Object.values(document.querySelector("[class*=modal]"))[0].return.memoizedState.memoizedState;
            for(const t of document.querySelectorAll("[class*=boxContent] > div"))t.remove();
            const l=Object.values(document.querySelector("[class*=modal]"))[0].return.memoizedState.next.next.memoizedState;
            Array.prototype.forEach.call(document.querySelector("[class*=chestsWrapper]").children, (e, t)=> {
                const o=e.firstChild.firstChild;
                if(l.includes(t))return o.style.opacity="";
                o.style.opacity="0.5";
                let n=document.createElement("div");
                n.innerHTML="<img src='"+r[2-c[t]]+"' style='max-width: 75%; max-height: 75%'></img>", n.className="chestESP", n.style.position="absolute", n.style.inset="0", n.style.display="grid", n.style.placeItems="center", n.style.pointerEvents="none", e.onclick=()=> {
                    n.remove(), o.style.opacity=""
                    }
                    , e.firstChild.prepend(n)
                    }
                    )
                    }
                    else alert("You must be in a heist!")
                }
                )();