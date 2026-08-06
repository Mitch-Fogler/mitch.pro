(()=> {
    let s=document.querySelector("iframe");
    if(s||((s=document.createElement("iframe")).style.display="none", document.body.append(s)), s.contentWindow.console.log.call(window, "%c Blooket Cheats %c\n\tBy 05Konzz on GitHub", "color: #0bc2cf; font-size: 3rem", "color: #8000ff; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tcrypto/autoGuess", "color: #0bc2cf; font-size: 1rem"), s.contentWindow.console.log.call(window, "%c\tStar the github repo!%c  https://github.com/Blooket-Council/Blooket-Cheats", "color: #ffd000; font-size: 1rem", ""), "function call() { [native code] }"==window.fetch.call.toString()) {
        const e=window.fetch.call;
        window.fetch.call=function() {
            if(!arguments[1].includes("s.blooket.com/rc"))return e.apply(this, arguments)
            }
            }
            const d=1730769903757;
            let u;
            const h=async()=> {
                var e=(() =>  {
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
                                                    )()["state"];
                                                    if("hack"==e.stage)for(const t of document.querySelector("div[class*=buttonContainer]").children)t.innerText==e.correctPassword&&t.click()
                                                    }
                                                    ;
                                                    let f=new Image;
                                                    f.src="https://raw.githubusercontent.com/Blooket-Council/Blooket-Cheats/main/autoupdate/timestamps/crypto/autoGuess.png?"+Date.now(), f.crossOrigin="Anonymous", f.onload=function() {
                                                        var e=document.createElement("canvas").getContext("2d");
                                                        e.drawImage(f, 0, 0, this.width, this.height);
                                                        let t=e.getImageData(0, 0, this.width, this.height)["data"], o="", n, c=0;
                                                        for(;
                                                        c<t.length;
                                                        ) {
                                                            var r=String.fromCharCode(t[c% 4==3&&c++, c++]+256*t[c% 4==3&&c++, c++]);
                                                            if(o+=r, "/"==r&&"*"==n)break;
                                                            n=r
                                                            }
                                                            let a, i=d, l="There was an error checking for script updates. Run cheat anyway?";
                                                            try {
                                                                [a, i, l]=o.match(/LastUpdated: (.+?);
                                                                ErrorMessage: "((.|\n)+?)"/)
                                                                }
                                                                catch(e) {
                                                                    }
                                                                    ((u=parseInt(i))<=d||s.contentWindow.confirm(l))&&h()
                                                                    }
                                                                    , f.onerror=f.onabort=()=> {
                                                                        f.onerror=f.onabort=null, h(), window.alert("It seems the GitHub is either blocked or down.\n\nIf it's NOT blocked, join the Discord server for updates\nhttps://discord.gg/jHjGrrdXP6\n(The cheat will still run after this alert)")
                                                                        }
                                                                    }
                                                                    )();