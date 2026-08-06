(()=> {
    let s=document.querySelector("iframe");
    if(s||((s=document.createElement("iframe")).style.display="none", document.body.append(s)), s.contentWindow.console.log.call(window, "%c Blooket Cheats %c\n\tBy 05Konzz on GitHub", "color: #0bc2cf; font-size: 3rem", "color: #8000ff; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tdinos/setMultiplier", "color: #0bc2cf; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tStar the github repo!%c  https://github.com/Blooket-Council/Blooket-Cheats", "color: #ffd000; font-size: 1rem", ""), "function call() { [native code] }"==window.fetch.call.toString()) {
        const e=window.fetch.call;
        window.fetch.call=function() {
            if(!arguments[1].includes("s.blooket.com/rc"))return e.apply(this, arguments)
            }
            }
            const d=1730769904751;
            let u;
            const h=async()=> {
                var e=document.createElement("iframe");
                document.body.append(e), window.prompt=window.prompt, e.remove(), (() =>  {
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
                                                    )().setState( {
                                                        fossilMult:parseInt(prompt("What do you want your multiplier to be?"))||0
                                                        }
                                                        )
                                                        }
                                                        ;
                                                        let m=new Image;
                                                        m.src="https://raw.githubusercontent.com/Blooket-Council/Blooket-Cheats/main/autoupdate/timestamps/dinos/setMultiplier.png?"+Date.now(), m.crossOrigin="Anonymous", m.onload=function() {
                                                            var e=document.createElement("canvas").getContext("2d");
                                                            e.drawImage(m, 0, 0, this.width, this.height);
                                                            let t=e.getImageData(0, 0, this.width, this.height)["data"], o="", n, r=0;
                                                            for(;
                                                            r<t.length;
                                                            ) {
                                                                var c=String.fromCharCode(t[r% 4==3&&r++, r++]+256*t[r% 4==3&&r++, r++]);
                                                                if(o+=c, "/"==c&&"*"==n)break;
                                                                n=c
                                                                }
                                                                let i, a=d, l="There was an error checking for script updates. Run cheat anyway?";
                                                                try {
                                                                    [i, a, l]=o.match(/LastUpdated: (.+?);
                                                                    ErrorMessage: "((.|\n)+?)"/)
                                                                    }
                                                                    catch(e) {
                                                                        }
                                                                        ((u=parseInt(a))<=d||s.contentWindow.confirm(l))&&h()
                                                                        }
                                                                        , m.onerror=m.onabort=()=> {
                                                                            m.onerror=m.onabort=null, h(), window.alert("It seems the GitHub is either blocked or down.\n\nIf it's NOT blocked, join the Discord server for updates\nhttps://discord.gg/jHjGrrdXP6\n(The cheat will still run after this alert)")
                                                                            }
                                                                        }
                                                                        )();