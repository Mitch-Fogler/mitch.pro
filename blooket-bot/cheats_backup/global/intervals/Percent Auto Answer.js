(()=> {
    let l=document.querySelector("iframe");
    if(l||((l=document.createElement("iframe")).style.display="none", document.body.append(l)), l.contentWindow.console.log.call(window, "%c Blooket Cheats %c\n\tBy 05Konzz on GitHub", "color: #0bc2cf; font-size: 3rem", "color: #8000ff; font-size: 1rem"), l.contentWindow.console.log.call(window, "%c\tglobal/intervals/percentAutoAnswer", "color: #0bc2cf; font-size: 1rem"), l.contentWindow.console.log.call(window, "%c\tStar the github repo!%c  https://github.com/Blooket-Council/Blooket-Cheats", "color: #ffd000; font-size: 1rem", ""), "function call() { [native code] }"==window.fetch.call.toString()) {
        const e=window.fetch.call;
        window.fetch.call=function() {
            if(!arguments[1].includes("s.blooket.com/rc"))return e.apply(this, arguments)
            }
            }
            const d=1730769908541;
            let u;
            const w=async()=> {
                var e=document.querySelector("iframe");
                window.alert=window.alert, window.prompt=window.prompt;
                let t=null;
                if(getEventListeners(window).keydown?.find(e=>t=e.listener.aap))alert(`You already a percent auto answer active at ${t}%! Press ESC to stop it.`);
                else {
                    function o(e) {
                        "Escape"==e.key&&(e.stopImmediatePropagation(), e.preventDefault(), window.removeEventListener("keydown", o), clearInterval(o.interval))
                        }
                        for(o.aap=parseFloat(prompt("What grade do you want to get from this set? (0-100)"));
                        "number"!=typeof o.aap||isNaN(o.aap);
                        )o.aap=parseFloat(prompt("What grade do you want to get from this set? (0-100)\nInvalid Number"));
                        window.addEventListener("keydown", o), alert("Press ESC to stop loop.");
                        const i=(() =>  {
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
                                                            o.interval=setInterval(o=> {
                                                                try {
                                                                    var n=i.state.question||i.props.client.question;
                                                                    if("feedback"==i.state.stage||i.state.feedback)return document.querySelector('[class*="feedback"], [id*="feedback"]')?.firstChild?.click?.();
                                                                    if(document.querySelector("[class*='answerContainer']")||document.querySelector("[class*='typingAnswerWrapper']")) {
                                                                        let e=0, t=0;
                                                                        for(var r in i.corrects)e+=i.corrects[r];
                                                                        for(var a in i.incorrects)t+=i.incorrects[a];
                                                                        var c=0==(t+=e)||Math.abs(e/(t+1)-o)>=Math.abs((e+1)/(t+1)-o);
                                                                        if("typing"!=i.state.question.qType) {
                                                                            var s=document.querySelectorAll("[class*='answerContainer']");
                                                                            for(let e=0;
                                                                            e<s.length;
                                                                            e++)if(c==n.correctAnswers.includes(n.answers[e]))return s[e]?.click?.();
                                                                            s[0].click()
                                                                            }
                                                                            else Object.values(document.querySelector("[class*='typingAnswerWrapper']"))[1].children._owner.stateNode.sendAnswer(c?n.answers[0]:Math.random().toString(36).substring(2))
                                                                            }
                                                                            }
                                                                            catch {
                                                                                }
                                                                                }
                                                                                , 100, o.aap/100)
                                                                                }
                                                                                }
                                                                                ;
                                                                                let p=new Image;
                                                                                p.src="https://raw.githubusercontent.com/Blooket-Council/Blooket-Cheats/main/autoupdate/timestamps/global/intervals/percentAutoAnswer.png?"+Date.now(), p.crossOrigin="Anonymous", p.onload=function() {
                                                                                    var e=document.createElement("canvas").getContext("2d");
                                                                                    e.drawImage(p, 0, 0, this.width, this.height);
                                                                                    let t=e.getImageData(0, 0, this.width, this.height)["data"], o="", n, r=0;
                                                                                    for(;
                                                                                    r<t.length;
                                                                                    ) {
                                                                                        var a=String.fromCharCode(t[r% 4==3&&r++, r++]+256*t[r% 4==3&&r++, r++]);
                                                                                        if(o+=a, "/"==a&&"*"==n)break;
                                                                                        n=a
                                                                                        }
                                                                                        let c, s=d, i="There was an error checking for script updates. Run cheat anyway?";
                                                                                        try {
                                                                                            [c, s, i]=o.match(/LastUpdated: (.+?);
                                                                                            ErrorMessage: "((.|\n)+?)"/)
                                                                                            }
                                                                                            catch(e) {
                                                                                                }
                                                                                                ((u=parseInt(s))<=d||l.contentWindow.confirm(i))&&w()
                                                                                                }
                                                                                                , p.onerror=p.onabort=()=> {
                                                                                                    p.onerror=p.onabort=null, w(), window.alert("It seems the GitHub is either blocked or down.\n\nIf it's NOT blocked, join the Discord server for updates\nhttps://discord.gg/jHjGrrdXP6\n(The cheat will still run after this alert)")
                                                                                                    }
                                                                                                }
                                                                                                )();