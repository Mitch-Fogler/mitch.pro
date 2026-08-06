(()=> {
    let s=document.querySelector("iframe");
    if(s||((s=document.createElement("iframe")).style.display="none", document.body.append(s)), s.contentWindow.console.log.call(window, "%c Blooket Cheats %c\n\tBy 05Konzz on GitHub", "color: #0bc2cf; font-size: 3rem", "color: #8000ff; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tglobal/sellDuplicateBlooks", "color: #0bc2cf; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tStar the github repo!%c  https://github.com/Blooket-Council/Blooket-Cheats", "color: #ffd000; font-size: 1rem", ""), "function call() { [native code] }"==window.fetch.call.toString()) {
        const e=window.fetch.call;
        window.fetch.call=function() {
            if(!arguments[1].includes("s.blooket.com/rc"))return e.apply(this, arguments)
            }
            }
            const d=1730769907938;
            let u;
            const h=async()=> {
                var e=document.createElement("iframe");
                if(document.body.append(e), window.alert=window.alert, window.confirm=window.confirm, e.remove(), window.location.pathname.startsWith("/blooks")) {
                    if(confirm("Are you sure you want to sell your dupes? (Legendaries and rarer will not be sold)")) {
                        var o=(() =>  {
                            const findReactNode = () =>  {
                                let root = document.querySelector("body>div");
                                const queue = [root];
                                while (queue.length > 0)  {
                                    const el = queue.shift();
                                    if (!el) continue;
                                    const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                                    if (reactKey)  {
                                        const fiber = el[reactKey];
                                        let candidate = fiber?.child;
                                        while (candidate)  {
                                            if (candidate.stateNode && (candidate.stateNode.setState || candidate.stateNode.props?.liveGameController))  {
                                                return candidate.stateNode;
                                                }
                                                candidate = candidate.sibling || candidate.child;
                                                }
                                                const stateNode = fiber?.child?.stateNode || fiber?.memoizedProps?.liveGameController?._owner?.stateNode || fiber?.return?.stateNode;
                                                if (stateNode) return stateNode;
                                                }
                                                const children = Array.from(el.children);
                                                queue.push(...children);
                                                }
                                                let current = document.querySelector("#app") || document.querySelector("#root") || document.body;
                                                const reactKey = Object.keys(current).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                                                if (reactKey)  {
                                                    let fiber = current[reactKey];
                                                    while (fiber)  {
                                                        if (fiber.stateNode && (fiber.stateNode.setState || fiber.stateNode.props?.liveGameController))  {
                                                            return fiber.stateNode;
                                                            }
                                                            fiber = fiber.return;
                                                            }
                                                            }
                                                            return null;
                                                            }
                                                            ;
                                                            return findReactNode();
                                                            }
                                                            )();
                                                            let e=Date.now(), t="";
                                                            for(const n in o.state.blookData)if(1<o.state.blookData[n]) {
                                                                if(o.setState( {
                                                                    blook:n, numToSell:o.state.blookData[n]-1
                                                                    }
                                                                    ), !["Uncommon", "Rare", "Epic"].includes(document.querySelector("[class*='highlightedRarity']").innerText.trim()))continue;
                                                                    t+=`    ${n} ${o.state.blookData[n]-1}\n`, await o.sellBlook( {
                                                                        preventDefault:()=> {
                                                                            }
                                                                            }
                                                                            , !0)
                                                                            }
                                                                            alert(`(${Date.now()-e}ms) Results:\n`+t.trim())
                                                                            }
                                                                            }
                                                                            else alert("This can only be ran in the Blooks page.")
                                                                            }
                                                                            ;
                                                                            let w=new Image;
                                                                            w.src="https://raw.githubusercontent.com/Blooket-Council/Blooket-Cheats/main/autoupdate/timestamps/global/sellDuplicateBlooks.png?"+Date.now(), w.crossOrigin="Anonymous", w.onload=function() {
                                                                                var e=document.createElement("canvas").getContext("2d");
                                                                                e.drawImage(w, 0, 0, this.width, this.height);
                                                                                let t=e.getImageData(0, 0, this.width, this.height)["data"], o="", n, a=0;
                                                                                for(;
                                                                                a<t.length;
                                                                                ) {
                                                                                    var r=String.fromCharCode(t[a% 4==3&&a++, a++]+256*t[a% 4==3&&a++, a++]);
                                                                                    if(o+=r, "/"==r&&"*"==n)break;
                                                                                    n=r
                                                                                    }
                                                                                    let l, i=d, c="There was an error checking for script updates. Run cheat anyway?";
                                                                                    try {
                                                                                        [l, i, c]=o.match(/LastUpdated: (.+?);
                                                                                        ErrorMessage: "((.|\n)+?)"/)
                                                                                        }
                                                                                        catch(e) {
                                                                                            }
                                                                                            ((u=parseInt(i))<=d||s.contentWindow.confirm(c))&&h()
                                                                                            }
                                                                                            , w.onerror=w.onabort=()=> {
                                                                                                w.onerror=w.onabort=null, h(), window.alert("It seems the GitHub is either blocked or down.\n\nIf it's NOT blocked, join the Discord server for updates\nhttps://discord.gg/jHjGrrdXP6\n(The cheat will still run after this alert)")
                                                                                                }
                                                                                            }
                                                                                            )();